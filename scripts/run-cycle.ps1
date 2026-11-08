param(
    [switch]$Force,
    [switch]$Publish,
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
$statePath = Join-Path $repoRoot "data\state.json"
$runtimeDir = if ($RuntimeDir) { [IO.Path]::GetFullPath($RuntimeDir) } else { Join-Path $repoRoot ".state" }
$logDir = if ($LogDir) { [IO.Path]::GetFullPath($LogDir) } else { Join-Path $repoRoot ".logs" }
$runsRoot = if ($RunsRoot) { [IO.Path]::GetFullPath($RunsRoot) } else { Join-Path (Split-Path $repoRoot -Parent) "BorderClash-Research-runs" }

New-Item -ItemType Directory -Force -Path $runtimeDir, $logDir, $runsRoot | Out-Null

function Write-RuntimeState {
    param([string]$Status, [string]$RunId, [string]$Message, [string]$Worktree = "")
    [ordered]@{
        updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        status = $Status
        runId = $RunId
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
        & git -C $repoRoot worktree remove --force $Worktree | Out-Null
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

    Invoke-Checked "pnpm" @("test") $repoRoot
    Invoke-Checked "pnpm" @("validate") $repoRoot

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
        "/goal Work in repository $worktree. Read AGENTS.md and complete one research cycle."
    }

    $stdoutPath = Join-Path $logDir "$runId.json"
    $stderrPath = Join-Path $logDir "$runId.stderr.log"
    Write-RuntimeState "running" $runId "Antigravity cycle started" $worktree

    Push-Location $worktree
    $previousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $agy -p $effectivePrompt --dangerously-skip-permissions --output-format json --model gemini-3.8-flash-medium --effort medium --print-timeout "$($TimeoutMinutes)m" 1> $stdoutPath 2> $stderrPath
        $agyExit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorAction
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

    $cycleHead = (git -C $worktree rev-parse HEAD).Trim()
    & git -C $worktree merge-base --is-ancestor $baseHead $cycleHead
    if ($LASTEXITCODE -ne 0) {
        throw "Agent rewrote branch history outside the cycle base."
    }

    Invoke-Checked "pnpm" @("research", "check") $worktree
    Invoke-Checked "node" @((Join-Path $repoRoot "scripts\validate.mjs")) $worktree
    Invoke-Checked "node" @((Join-Path $repoRoot "scripts\generate-public.mjs")) $worktree
    Invoke-Checked "node" @((Join-Path $repoRoot "scripts\validate.mjs")) $worktree
    Invoke-Checked "git" @("-C", $worktree, "diff", "--check") $worktree

    $changes = @(git -C $worktree status --porcelain)
    if ($LASTEXITCODE -ne 0) { throw "Could not inspect validated changes" }
    $cycleHead = (git -C $worktree rev-parse HEAD).Trim()
    $hasCommittedChanges = $cycleHead -ne $baseHead

    if (-not $changes -and -not $hasCommittedChanges) {
        Write-RuntimeState "success" $runId "Cycle completed with no changes"
        Remove-CycleWorktree $worktree $branch
        Write-Output "SUCCESS: no changes conversation=$($result.conversation_id)"
        exit 0
    }

    Write-Output "VALIDATED CHANGES:"
    if ($hasCommittedChanges) {
        git -C $worktree log --oneline "$baseHead..$cycleHead"
    }
    if ($changes) {
        git -C $worktree diff --stat
        Invoke-Checked "git" @("-C", $worktree, "add", "-A") $worktree
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
