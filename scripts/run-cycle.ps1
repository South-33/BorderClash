param(
    [switch]$Force,
    [switch]$Publish,
    [int]$TimeoutMinutes = 45,
    [string]$Prompt = "",
    [string]$Model = "",
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
$statePath = Join-Path $repoRoot "data\state.json"
$runnerRoot = Join-Path $repoRoot ".work\runner"
$runtimeDir = if ($RuntimeDir) { [IO.Path]::GetFullPath($RuntimeDir) } else { Join-Path $runnerRoot "runtime" }
$logDir = if ($LogDir) { [IO.Path]::GetFullPath($LogDir) } else { Join-Path $runnerRoot "logs" }
$runsRoot = if ($RunsRoot) { [IO.Path]::GetFullPath($RunsRoot) } else { Join-Path $runnerRoot "runs" }
$agyModel = if ($Model) { $Model } elseif ($env:BORDERCLASH_AGY_MODEL) { $env:BORDERCLASH_AGY_MODEL } else { "gemini-3.8-flash-medium" }

New-Item -ItemType Directory -Force -Path $runtimeDir, $logDir, $runsRoot | Out-Null

function Write-RuntimeState {
    param([string]$Status, [string]$RunId, [string]$Message, [string]$Worktree = "")
    [ordered]@{
        updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        status = $Status
        runId = $RunId
        model = $agyModel
        message = $Message
        worktree = $Worktree
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
    [ordered]@{
        detectedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        status = "interrupted"
        runId = $previousRunId
        message = "Previous runner ended without a final status; the cycle mutex is no longer owned."
        worktree = [string]$previous.worktree
    } | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $logDir "$previousRunId.interrupted.json")

    Write-RuntimeState "interrupted" $previousRunId "Recovered stale running state from an interrupted process" ([string]$previous.worktree)
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
    $state = Get-Content $statePath -Raw | ConvertFrom-Json
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

    $dirty = git -C $repoRoot status --porcelain
    if ($LASTEXITCODE -ne 0) { throw "git status failed" }
    if ($dirty) { throw "Root checkout must be clean before a research cycle" }

    if ($Publish) {
        $currentBranch = (git -C $repoRoot branch --show-current).Trim()
        if ($currentBranch -ne "main") {
            throw "Publication requires the root checkout to be on main (current: $currentBranch)"
        }
    }

    Invoke-Checked "node" @("--test", "tests/data-layout.test.mjs", "tests/language.test.mjs", "tests/reader-language.test.mjs") $repoRoot
    Invoke-Checked "node" @("scripts/validate.mjs") $repoRoot

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
    $baseHead = (git -C $repoRoot rev-parse HEAD).Trim()

    Invoke-Checked "git" @("-C", $repoRoot, "worktree", "add", "-b", $branch, $worktree, $baseHead) $repoRoot

    $effectivePrompt = if ($Prompt) {
        $Prompt
    } else {
        "/goal In repository $worktree, read AGENTS.md, run node scripts/research.mjs, and complete exactly one research cycle."
    }

    $stdoutPath = Join-Path $logDir "$runId.json"
    $stderrPath = Join-Path $logDir "$runId.stderr.log"
    Write-RuntimeState "running" $runId "Antigravity cycle started" $worktree

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

    $worktreeStatePath = Join-Path $worktree "data\state.json"
    $worktreeState = Get-Content $worktreeStatePath -Raw | ConvertFrom-Json
    if ([bool]$worktreeState.isPaused -ne [bool]$state.isPaused) {
        $stateText = Get-Content $worktreeStatePath -Raw
        $currentPause = if ([bool]$worktreeState.isPaused) { "true" } else { "false" }
        $desiredPause = if ([bool]$state.isPaused) { "true" } else { "false" }
        $stateText = $stateText -replace ('("isPaused"\s*:\s*)' + $currentPause), ('${1}' + $desiredPause)
        [IO.File]::WriteAllText($worktreeStatePath, $stateText, [Text.UTF8Encoding]::new($false))
    }

    $cycleHead = (git -C $worktree rev-parse HEAD).Trim()
    & git -C $worktree merge-base --is-ancestor $baseHead $cycleHead
    if ($LASTEXITCODE -ne 0) {
        throw "Agent rewrote branch history outside the cycle base."
    }

    Invoke-Checked "node" @("scripts/research.mjs", "check") $worktree
    Invoke-Checked "node" @("--test", (Join-Path $repoRoot "tests\reader-language.test.mjs")) $worktree
    Invoke-Checked "node" @((Join-Path $repoRoot "scripts\validate.mjs")) $worktree
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

    if (-not $hasStagedChanges -and -not $hasCommittedChanges) {
        Write-RuntimeState "success" $runId "Cycle completed with no changes"
        Remove-CycleWorktree $worktree $branch
        Write-Output "SUCCESS: no changes conversation=$($result.conversation_id)"
        exit 0
    }

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
        Write-RuntimeState "validated" $runId "Shadow cycle passed; publication disabled" $worktree
        Write-Output "SHADOW SUCCESS: conversation=$($result.conversation_id)"
        Write-Output "commit=$cycleCommit"
        Write-Output "worktree=$worktree"
        exit 0
    }

    Invoke-Checked "git" @("-C", $repoRoot, "merge", "--ff-only", $cycleCommit) $repoRoot
    Invoke-Checked "git" @("-C", $repoRoot, "push", "origin", "main") $repoRoot

    Write-RuntimeState "published" $runId "Published validated cycle $cycleCommit"
    Remove-CycleWorktree $worktree $branch
    Write-Output "PUBLISHED: $cycleCommit conversation=$($result.conversation_id)"
}
catch {
    $message = $_.Exception.Message
    Write-RuntimeState "failed" $runId $message $worktree
    Write-Error $message
    exit 1
}
finally {
    if ($lock) {
        try { $lock.ReleaseMutex() } catch { }
        $lock.Dispose()
    }
}
