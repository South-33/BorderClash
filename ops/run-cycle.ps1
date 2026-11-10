param(
    [switch]$Force,
    [switch]$Publish,
    [string]$RemoteName = "origin",
    [int]$TimeoutMinutes = 45,
    [string]$Prompt = "",
    [string]$AgyPath = "",
    [string]$RunsRoot = "",
    [string]$RuntimeDir = "",
    [string]$LogDir = "",
    [string]$MutexName = "Global\BorderClashResearchCycle"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runnerRoot = Join-Path $repoRoot ".work\runner"
$runtimeDir = if ($RuntimeDir) { [IO.Path]::GetFullPath($RuntimeDir) } else { Join-Path $runnerRoot "runtime" }
$logDir = if ($LogDir) { [IO.Path]::GetFullPath($LogDir) } else { Join-Path $runnerRoot "logs" }
$runsRoot = if ($RunsRoot) { [IO.Path]::GetFullPath($RunsRoot) } else { Join-Path $runnerRoot "runs" }
$agyModel = "gemini-3.8-flash-medium"

New-Item -ItemType Directory -Force -Path $runtimeDir, $logDir, $runsRoot | Out-Null

function Write-RuntimeState {
    param(
        [string]$Status,
        [string]$RunId,
        [string]$Message,
        [string]$RunDir = ""
    )
    [ordered]@{
        updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        status = $Status
        runId = $RunId
        model = $agyModel
        message = $Message
        runDir = $RunDir
    } | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $runtimeDir "runtime.json")
}

function Acquire-CycleLock {
    $mutex = [Threading.Mutex]::new($false, $MutexName)
    try {
        $acquired = $mutex.WaitOne(0)
    } catch [Threading.AbandonedMutexException] {
        $acquired = $true
    }
    if (-not $acquired) {
        $mutex.Dispose()
        return $null
    }
    return $mutex
}

function Recover-StaleRuntimeState {
    $runtimePath = Join-Path $runtimeDir "runtime.json"
    if (-not (Test-Path $runtimePath)) { return }

    try {
        $previous = Get-Content $runtimePath -Raw | ConvertFrom-Json
    } catch {
        return
    }

    if ($previous.status -ne "running") { return }

    $previousRunId = if ($previous.runId) { [string]$previous.runId } else { "unknown" }
    $previousRunDir = if ($previous.PSObject.Properties["runDir"] -and $previous.runDir) {
        [string]$previous.runDir
    } elseif ($previous.PSObject.Properties["worktree"] -and $previous.worktree) {
        # Compatibility with runtime state written by the old worktree runner.
        [string]$previous.worktree
    } else { "" }
    $previousBranch = if ($previous.PSObject.Properties["branch"]) { [string]$previous.branch } else { "" }

    [ordered]@{
        detectedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        status = "interrupted"
        runId = $previousRunId
        message = "Previous runner ended without a final status; the cycle mutex is no longer owned."
        runDir = $previousRunDir
    } | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $logDir "$previousRunId.interrupted.json")

    if ($previousRunDir) {
        $candidate = [IO.Path]::GetFullPath($previousRunDir).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
        $ownedRoot = [IO.Path]::GetFullPath($runsRoot).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
        $ownedPrefix = $ownedRoot + [IO.Path]::DirectorySeparatorChar
        if ($candidate.StartsWith($ownedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            if ($previousBranch) {
                & git -C $repoRoot worktree remove --force $candidate 2>$null | Out-Null
                & git -C $repoRoot worktree prune --expire now 2>$null | Out-Null
                & git -C $repoRoot branch -D $previousBranch 2>$null | Out-Null
            }
            Remove-RunDirectory $candidate
        }
    }

    Write-RuntimeState "interrupted" $previousRunId "Recovered stale running state from an interrupted process" $previousRunDir
}

function Invoke-Checked {
    param([string]$File, [string[]]$Arguments, [string]$WorkingDirectory)

    Push-Location $WorkingDirectory
    try {
        & $File @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "$File exited with code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
}

function Read-State {
    param([string]$Path)
    return Get-Content $Path -Raw | ConvertFrom-Json
}

function Read-StateFromRef {
    param([string]$Ref)

    $spec = "${Ref}:data/state.json"
    $json = & git -C $repoRoot show $spec
    if ($LASTEXITCODE -ne 0) { throw "Could not read scheduler state from $Ref" }
    return ([string]::Join([Environment]::NewLine, [string[]]$json) | ConvertFrom-Json)
}

function Assert-CycleStateAdvanced {
    param($Before, $After)

    if ([int64]$After.lastResearchAt -le [int64]$Before.lastResearchAt) {
        throw "Cycle did not advance lastResearchAt"
    }
    if ([int64]$After.nextRunAt -le [int64]$After.lastResearchAt) {
        throw "Cycle did not schedule a future nextRunAt"
    }
    if ([int64]$After.researchCycleCount -ne ([int64]$Before.researchCycleCount + 1)) {
        throw "Cycle must increment researchCycleCount exactly once"
    }
    if ([string]$After.scheduler -ne "external") {
        throw "Cycle changed scheduler ownership"
    }
    if ([string]$After.systemStatus -ne "online") {
        throw "Cycle did not leave systemStatus online"
    }
    if ([bool]$After.isPaused -ne [bool]$Before.isPaused) {
        throw "Cycle changed operator pause state"
    }
}

function Assert-ResearchOnlyPaths {
    param([string]$RunDir, [string]$BaseHead)

    $paths = @()
    $paths += @(& git -C $RunDir diff --name-only $BaseHead --)
    if ($LASTEXITCODE -ne 0) { throw "Could not inspect cycle diff paths" }
    $paths += @(& git -C $RunDir ls-files --others --exclude-standard)
    if ($LASTEXITCODE -ne 0) { throw "Could not inspect untracked cycle paths" }

    foreach ($path in ($paths | Where-Object { $_ } | Sort-Object -Unique)) {
        $normalized = ([string]$path).Replace("\\", "/")
        if (-not $normalized.StartsWith("data/", [StringComparison]::Ordinal)) {
            throw "Routine research may only change data/: $normalized"
        }
    }
}

function Remove-RunDirectory {
    param([string]$RunDir)

    if (-not $RunDir -or -not (Test-Path -LiteralPath $RunDir)) { return }
    Remove-Item -LiteralPath $RunDir -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $RunDir) {
        $full = [IO.Path]::GetFullPath($RunDir)
        $extended = if ($full.StartsWith("\\")) { "\\?\UNC\" + $full.Substring(2) } else { "\\?\" + $full }
        & cmd.exe /d /c "rd /s /q `"$extended`"" | Out-Null
    }
    if (Test-Path -LiteralPath $RunDir) { throw "Could not remove run directory $RunDir" }
}

$lock = Acquire-CycleLock
if ($null -eq $lock) {
    Write-Output "SKIP: already-running"
    exit 0
}

Recover-StaleRuntimeState

$runId = ""
$runDir = ""

try {
    if ($Publish) {
        Invoke-Checked "git" @("-C", $repoRoot, "fetch", $RemoteName, "main") $repoRoot
        $baseRef = "$RemoteName/main"
    } else {
        $baseRef = "HEAD"
    }

    $baseHead = (& git -C $repoRoot rev-parse $baseRef).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $baseHead) { throw "Could not resolve cycle base $baseRef" }
    $state = Read-StateFromRef $baseHead
    $nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

    if (-not $Force -and $state.isPaused) {
        Write-Output "SKIP: paused"
        exit 0
    }

    if (-not $Force -and $state.nextRunAt -and [int64]$state.nextRunAt -gt $nowMs) {
        $next = [DateTimeOffset]::FromUnixTimeMilliseconds([int64]$state.nextRunAt).ToLocalTime()
        Write-Output "SKIP: not-due nextRunAt=$($next.ToString('o'))"
        exit 0
    }

    if ($Publish) {
        Write-Output "PRODUCTION BASE: $baseHead ($baseRef)"
    }

    $agyCommand = Get-Command agy -ErrorAction SilentlyContinue
    $agy = if ($AgyPath) {
        (Resolve-Path $AgyPath).Path
    } elseif ($agyCommand) {
        $agyCommand.Source
    } else {
        Join-Path $env:LOCALAPPDATA "agy\bin\agy.exe"
    }
    if (-not (Test-Path $agy)) { throw "Antigravity CLI not found" }

    $runId = [DateTimeOffset]::UtcNow.ToString("yyyyMMddTHHmmssfffZ")
    $runDir = Join-Path $runsRoot $runId
    Invoke-Checked "git" @("clone", "--quiet", "--no-checkout", "--no-hardlinks", $repoRoot, $runDir) $repoRoot
    Invoke-Checked "git" @("-C", $runDir, "checkout", "--quiet", "--detach", $baseHead) $runDir
    if ($Publish) {
        $remoteUrl = (& git -C $repoRoot remote get-url $RemoteName).Trim()
        if ($LASTEXITCODE -ne 0 -or -not $remoteUrl) { throw "Could not resolve remote URL for $RemoteName" }
        Invoke-Checked "git" @("-C", $runDir, "remote", "set-url", "origin", $remoteUrl) $runDir
    }
    Invoke-Checked "node" @((Join-Path $runDir "scripts\research.mjs"), "check") $runDir

    $cycleContextDir = Join-Path $runDir ".work"
    $cycleContextPath = Join-Path $cycleContextDir "CYCLE_CONTEXT.json"
    New-Item -ItemType Directory -Force -Path $cycleContextDir | Out-Null
    Push-Location $runDir
    try {
        $contextOutput = & node "scripts\research.mjs" 2>&1
        $contextExit = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    if ($contextExit -ne 0) { throw "Could not generate cycle context" }
    [IO.File]::WriteAllText(
        $cycleContextPath,
        [string]::Join([Environment]::NewLine, [string[]]$contextOutput) + [Environment]::NewLine,
        [Text.UTF8Encoding]::new($false)
    )
    Copy-Item -LiteralPath $cycleContextPath -Destination (Join-Path $logDir "$runId.context.json") -Force

    $effectivePrompt = if ($Prompt) {
        $Prompt
    } else {
        @'
You have been woken up for one BorderClash research cycle. Read AGENTS.md and .work/CYCLE_CONTEXT.json, then use your judgment to leave the canonical research record as accurate, clear, and current as the evidence supports. Use the archive CLI or direct file reads only when you need more context. Stop when further work is unlikely to improve the record. Work only on research data; the outer runner owns Git publication and deployment. End with <!-- GOAL_COMPLETE --> and include HARNESS_FEEDBACK only when you have one concise actionable improvement.
'@
    }

    $stdoutPath = Join-Path $logDir "$runId.result.json"
    $stderrPath = Join-Path $logDir "$runId.stderr.log"
    $agyLogPath = Join-Path $logDir "$runId.agy.log"
    Write-RuntimeState "running" $runId "Antigravity cycle started" $runDir

    Push-Location $runDir
    $previousErrorAction = $ErrorActionPreference
    $previousConsoleEncoding = [Console]::OutputEncoding
    $previousOutputEncoding = $OutputEncoding
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $ErrorActionPreference = "Continue"
    try {
        [Console]::OutputEncoding = $utf8NoBom
        $OutputEncoding = $utf8NoBom
        $stdout = & $agy -p $effectivePrompt --dangerously-skip-permissions --output-format json --model $agyModel --print-timeout "$($TimeoutMinutes)m" --log-file $agyLogPath 2> $stderrPath
        $agyExit = $LASTEXITCODE
        [IO.File]::WriteAllText($stdoutPath, [string]::Join([Environment]::NewLine, [string[]]$stdout), $utf8NoBom)
    } finally {
        $ErrorActionPreference = $previousErrorAction
        [Console]::OutputEncoding = $previousConsoleEncoding
        $OutputEncoding = $previousOutputEncoding
        Pop-Location
    }

    if ($agyExit -ne 0) {
        throw "Antigravity exited $agyExit. See $stdoutPath and $stderrPath"
    }

    $result = Get-Content $stdoutPath -Raw | ConvertFrom-Json
    if ($result.status -ne "SUCCESS") {
        throw "Antigravity status was $($result.status)"
    }
    if (-not ([string]$result.response).Contains("<!-- GOAL_COMPLETE -->")) {
        throw "Antigravity did not confirm goal completion"
    }
    $feedback = [regex]::Match([string]$result.response, '(?m)^HARNESS_(?:FEEDBACK|NOTE):\s*(.+)$')
    if ($feedback.Success) {
        [IO.File]::WriteAllText(
            (Join-Path $logDir "$runId.feedback.txt"),
            $feedback.Groups[1].Value.Trim() + [Environment]::NewLine,
            [Text.UTF8Encoding]::new($false)
        )
    }

    $runStatePath = Join-Path $runDir "data\state.json"
    $runState = Read-State $runStatePath
    if ([bool]$runState.isPaused -ne [bool]$state.isPaused) {
        $stateText = Get-Content $runStatePath -Raw
        $currentPause = if ([bool]$runState.isPaused) { "true" } else { "false" }
        $desiredPause = if ([bool]$state.isPaused) { "true" } else { "false" }
        $stateText = $stateText -replace ('("isPaused"\s*:\s*)' + $currentPause), ('${1}' + $desiredPause)
        [IO.File]::WriteAllText($runStatePath, $stateText, [Text.UTF8Encoding]::new($false))
        $runState = Read-State $runStatePath
    }
    Assert-CycleStateAdvanced $state $runState
    Assert-ResearchOnlyPaths $runDir $baseHead

    $cycleHead = (git -C $runDir rev-parse HEAD).Trim()
    & git -C $runDir merge-base --is-ancestor $baseHead $cycleHead
    if ($LASTEXITCODE -ne 0) {
        throw "Agent rewrote branch history outside the cycle base."
    }

    Invoke-Checked "node" @((Join-Path $runDir "scripts\research.mjs"), "check") $runDir
    Invoke-Checked "node" @((Join-Path $runDir "scripts\generate-public.mjs")) $runDir
    Invoke-Checked "git" @("-C", $runDir, "diff", "--check") $runDir

    $dataPatch = & git -C $runDir diff --binary $baseHead -- data
    if ($LASTEXITCODE -ne 0) { throw "Could not capture research data diff" }
    [IO.File]::WriteAllText(
        (Join-Path $logDir "$runId.data.patch"),
        [string]::Join([Environment]::NewLine, [string[]]$dataPatch) + [Environment]::NewLine,
        [Text.UTF8Encoding]::new($false)
    )

    $cycleHead = (git -C $runDir rev-parse HEAD).Trim()
    $hasCommittedChanges = $cycleHead -ne $baseHead

    Invoke-Checked "git" @("-C", $runDir, "add", "-A") $runDir
    & git -C $runDir diff --cached --quiet
    $stagedDiffExit = $LASTEXITCODE
    if ($stagedDiffExit -notin @(0, 1)) {
        throw "Could not inspect staged cycle changes"
    }
    $hasStagedChanges = $stagedDiffExit -eq 1

    Write-Output "VALIDATED CHANGES:"
    if ($hasCommittedChanges) {
        git -C $runDir log --oneline "$baseHead..$cycleHead"
    }
    if ($hasStagedChanges) {
        git -C $runDir diff --cached --stat
        Invoke-Checked "git" @(
            "-C", $runDir,
            "-c", "user.name=BorderClash Research",
            "-c", "user.email=borderclash-research@local.invalid",
            "commit", "-m", "research: complete BorderClash cycle ($runId)"
        ) $runDir
    }
    $cycleCommit = (git -C $runDir rev-parse HEAD).Trim()

    if (-not $Publish) {
        Write-RuntimeState "validated" $runId "Shadow cycle passed; publication disabled" $runDir
        Write-Output "SHADOW SUCCESS: conversation=$($result.conversation_id)"
        Write-Output "commit=$cycleCommit"
        Remove-RunDirectory $runDir
        exit 0
    }

    # Publishing never mutates the developer checkout. Recheck remote main to
    # avoid racing another deployment, then fast-forward the validated commit.
    Invoke-Checked "git" @("-C", $runDir, "fetch", "origin", "main") $runDir
    $remoteHead = (& git -C $runDir rev-parse "origin/main").Trim()
    if ($LASTEXITCODE -ne 0) { throw "Could not resolve origin/main before publication" }
    if ($remoteHead -ne $baseHead) {
        throw "Remote main advanced during the cycle; refusing to publish stale research"
    }
    Invoke-Checked "git" @("-C", $runDir, "push", "origin", "${cycleCommit}:refs/heads/main") $runDir

    Write-RuntimeState "published" $runId "Published validated cycle $cycleCommit" $runDir
    Remove-RunDirectory $runDir
    Write-Output "PUBLISHED: $cycleCommit conversation=$($result.conversation_id)"
}
catch {
    $message = $_.Exception.Message
    Write-RuntimeState "failed" $runId $message $runDir
    Write-Error $message
    exit 1
}
finally {
    if ($lock) {
        try { $lock.ReleaseMutex() } catch { }
        $lock.Dispose()
    }
}
