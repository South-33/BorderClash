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
    [string]$MutexName = "Global\BorderClashResearchCycle",
    [string]$BranchPrefix = "cycle"
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
        [string]$Worktree = "",
        [string]$Branch = ""
    )
    [ordered]@{
        updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        status = $Status
        runId = $RunId
        model = $agyModel
        message = $Message
        worktree = $Worktree
        branch = $Branch
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
    $previousWorktree = if ($previous.worktree) { [string]$previous.worktree } else { "" }
    $previousBranch = if ($previous.PSObject.Properties["branch"]) { [string]$previous.branch } else { "" }

    if (-not $previousBranch -and $previousWorktree -and (Test-Path -LiteralPath $previousWorktree)) {
        $detectedBranch = & git -C $previousWorktree branch --show-current 2>$null
        if ($LASTEXITCODE -eq 0) {
            $previousBranch = ([string]$detectedBranch).Trim()
        }
    }

    [ordered]@{
        detectedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        status = "interrupted"
        runId = $previousRunId
        message = "Previous runner ended without a final status; the cycle mutex is no longer owned."
        worktree = $previousWorktree
        branch = $previousBranch
    } | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $logDir "$previousRunId.interrupted.json")

    if ($previousWorktree) {
        $candidate = [IO.Path]::GetFullPath($previousWorktree).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
        $ownedRoot = [IO.Path]::GetFullPath($runsRoot).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
        $ownedPrefix = $ownedRoot + [IO.Path]::DirectorySeparatorChar
        if ($candidate.StartsWith($ownedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            Remove-CycleWorktree $candidate $previousBranch
        }
    }

    Write-RuntimeState "interrupted" $previousRunId "Recovered stale running state from an interrupted process" $previousWorktree $previousBranch
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
    param([string]$Worktree, [string]$BaseHead)

    $paths = @()
    $paths += @(& git -C $Worktree diff --name-only $BaseHead --)
    if ($LASTEXITCODE -ne 0) { throw "Could not inspect cycle diff paths" }
    $paths += @(& git -C $Worktree ls-files --others --exclude-standard)
    if ($LASTEXITCODE -ne 0) { throw "Could not inspect untracked cycle paths" }

    foreach ($path in ($paths | Where-Object { $_ } | Sort-Object -Unique)) {
        $normalized = ([string]$path).Replace("\\", "/")
        if (-not $normalized.StartsWith("data/", [StringComparison]::Ordinal)) {
            throw "Routine research may only change data/: $normalized"
        }
    }
}

function Remove-CycleWorktree {
    param([string]$Worktree, [string]$Branch)

    if ($Worktree -and (Test-Path $Worktree)) {
        $nodeModules = Join-Path $Worktree "node_modules"
        if (Test-Path $nodeModules) {
            try {
                Remove-Item -LiteralPath $nodeModules -Recurse -Force -ErrorAction Stop
            } catch {
                Write-Warning "Could not remove worktree node_modules cleanly: $($_.Exception.Message)"
            }
        }
        & git -C $repoRoot worktree remove --force $Worktree | Out-Null
        if ($LASTEXITCODE -ne 0) {
            & git -C $repoRoot worktree prune | Out-Null
            if (Test-Path $Worktree) {
                try {
                    Remove-Item -LiteralPath $Worktree -Recurse -Force -ErrorAction Stop
                } catch {
                    Write-Warning "Could not fully remove stale worktree $Worktree"
                }
            }
        }
    }
    if ($Branch) {
        & git -C $repoRoot worktree prune --expire now | Out-Null
        & git -C $repoRoot branch -D $Branch | Out-Null
    }
}

$lock = Acquire-CycleLock
if ($null -eq $lock) {
    Write-Output "SKIP: already-running"
    exit 0
}

Recover-StaleRuntimeState

$runId = ""
$worktree = ""
$branch = ""

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
    $branch = "$BranchPrefix/$runId"
    $worktree = Join-Path $runsRoot $runId
    Invoke-Checked "git" @("-C", $repoRoot, "worktree", "add", "-b", $branch, $worktree, $baseHead) $repoRoot
    Invoke-Checked "node" @((Join-Path $worktree "scripts\research.mjs"), "check") $worktree

    $effectivePrompt = if ($Prompt) {
        $Prompt
    } else {
        "/goal Complete exactly one BorderClash research cycle. Read AGENTS.md first and treat it as the contract."
    }

    $stdoutPath = Join-Path $logDir "$runId.json"
    $stderrPath = Join-Path $logDir "$runId.stderr.log"
    Write-RuntimeState "running" $runId "Antigravity cycle started" $worktree $branch

    Push-Location $worktree
    $previousErrorAction = $ErrorActionPreference
    $previousConsoleEncoding = [Console]::OutputEncoding
    $previousOutputEncoding = $OutputEncoding
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $ErrorActionPreference = "Continue"
    try {
        [Console]::OutputEncoding = $utf8NoBom
        $OutputEncoding = $utf8NoBom
        $stdout = & $agy -p $effectivePrompt --dangerously-skip-permissions --output-format json --model $agyModel --print-timeout "$($TimeoutMinutes)m" 2> $stderrPath
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
    $note = [regex]::Match([string]$result.response, '(?m)^HARNESS_NOTE:\s*(.+)$')
    if ($note.Success) {
        [IO.File]::WriteAllText(
            (Join-Path $logDir "$runId.note.txt"),
            $note.Groups[1].Value.Trim() + [Environment]::NewLine,
            [Text.UTF8Encoding]::new($false)
        )
    }

    $worktreeStatePath = Join-Path $worktree "data\state.json"
    $worktreeState = Read-State $worktreeStatePath
    if ([bool]$worktreeState.isPaused -ne [bool]$state.isPaused) {
        $stateText = Get-Content $worktreeStatePath -Raw
        $currentPause = if ([bool]$worktreeState.isPaused) { "true" } else { "false" }
        $desiredPause = if ([bool]$state.isPaused) { "true" } else { "false" }
        $stateText = $stateText -replace ('("isPaused"\s*:\s*)' + $currentPause), ('${1}' + $desiredPause)
        [IO.File]::WriteAllText($worktreeStatePath, $stateText, [Text.UTF8Encoding]::new($false))
        $worktreeState = Read-State $worktreeStatePath
    }
    Assert-CycleStateAdvanced $state $worktreeState
    Assert-ResearchOnlyPaths $worktree $baseHead

    $cycleHead = (git -C $worktree rev-parse HEAD).Trim()
    & git -C $worktree merge-base --is-ancestor $baseHead $cycleHead
    if ($LASTEXITCODE -ne 0) {
        throw "Agent rewrote branch history outside the cycle base."
    }

    Invoke-Checked "node" @((Join-Path $repoRoot "scripts\research.mjs"), "check") $worktree
    Invoke-Checked "node" @((Join-Path $repoRoot "scripts\generate-public.mjs")) $worktree
    Invoke-Checked "git" @("-C", $worktree, "diff", "--check") $worktree

    $cycleHead = (git -C $worktree rev-parse HEAD).Trim()
    $hasCommittedChanges = $cycleHead -ne $baseHead

    Invoke-Checked "git" @("-C", $worktree, "add", "-A") $worktree
    & git -C $worktree diff --cached --quiet
    $stagedDiffExit = $LASTEXITCODE
    if ($stagedDiffExit -notin @(0, 1)) {
        throw "Could not inspect staged cycle changes"
    }
    $hasStagedChanges = $stagedDiffExit -eq 1

    Write-Output "VALIDATED CHANGES:"
    if ($hasCommittedChanges) {
        git -C $worktree log --oneline "$baseHead..$cycleHead"
    }
    if ($hasStagedChanges) {
        git -C $worktree diff --cached --stat
        Invoke-Checked "git" @(
            "-C", $worktree,
            "-c", "user.name=BorderClash Research",
            "-c", "user.email=borderclash-research@local.invalid",
            "commit", "-m", "research: complete BorderClash cycle ($runId)"
        ) $worktree
    }
    $cycleCommit = (git -C $worktree rev-parse HEAD).Trim()

    if (-not $Publish) {
        Write-RuntimeState "validated" $runId "Shadow cycle passed; publication disabled" $worktree $branch
        Write-Output "SHADOW SUCCESS: conversation=$($result.conversation_id)"
        Write-Output "commit=$cycleCommit"
        Write-Output "worktree=$worktree"
        exit 0
    }

    # Publishing never mutates the developer checkout. Recheck remote main to
    # avoid racing another deployment, then fast-forward the validated commit.
    Invoke-Checked "git" @("-C", $repoRoot, "fetch", $RemoteName, "main") $repoRoot
    $remoteHead = (& git -C $repoRoot rev-parse "$RemoteName/main").Trim()
    if ($LASTEXITCODE -ne 0) { throw "Could not resolve $RemoteName/main before publication" }
    if ($remoteHead -ne $baseHead) {
        throw "Remote main advanced during the cycle; refusing to publish stale research"
    }
    Invoke-Checked "git" @("-C", $repoRoot, "push", $RemoteName, "${cycleCommit}:refs/heads/main") $repoRoot

    Write-RuntimeState "published" $runId "Published validated cycle $cycleCommit" $worktree $branch
    Remove-CycleWorktree $worktree $branch
    Write-Output "PUBLISHED: $cycleCommit conversation=$($result.conversation_id)"
}
catch {
    $message = $_.Exception.Message
    Write-RuntimeState "failed" $runId $message $worktree $branch
    Write-Error $message
    exit 1
}
finally {
    if ($lock) {
        try { $lock.ReleaseMutex() } catch { }
        $lock.Dispose()
    }
}
