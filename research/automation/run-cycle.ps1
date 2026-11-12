param(
    [switch]$Force,
    [switch]$Publish,
    [string]$RemoteName = "origin",
    [int]$TimeoutMinutes = 45,
    [string]$Model = "",
    [string]$Prompt = "",
    [string]$AgyPath = "",
    [string]$RunsRoot = "",
    [string]$RuntimeDir = "",
    [string]$LogDir = "",
    [string]$MutexName = "Global\BorderClashResearchCycle"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$runnerRoot = Join-Path $repoRoot ".work\runner"
$runtimeDir = if ($RuntimeDir) { [IO.Path]::GetFullPath($RuntimeDir) } else { Join-Path $runnerRoot "runtime" }
$logDir = if ($LogDir) { [IO.Path]::GetFullPath($LogDir) } else { Join-Path $runnerRoot "logs" }
$runsRoot = if ($RunsRoot) { [IO.Path]::GetFullPath($RunsRoot) } else { Join-Path $runnerRoot "runs" }
$agyModel = if ($Model) {
    $Model
} elseif ($env:BORDERCLASH_RESEARCH_MODEL) {
    $env:BORDERCLASH_RESEARCH_MODEL
} else {
    "gemini-3.8-flash-medium"
}

New-Item -ItemType Directory -Force -Path $runtimeDir, $logDir, $runsRoot | Out-Null

function Write-RuntimeState {
    param(
        [string]$Status,
        [string]$RunId,
        [string]$Message,
        [string]$RunDir = "",
        [string]$BaseHead = "",
        [string]$ConversationId = "",
        [int]$ResumeCount = 0,
        [string]$RecoveryReason = ""
    )
    $payload = [ordered]@{
        updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        status = $Status
        runId = $RunId
        model = $agyModel
        message = $Message
        runDir = $RunDir
    }
    if ($BaseHead) { $payload.baseHead = $BaseHead }
    if ($ConversationId) { $payload.conversationId = $ConversationId }
    if ($ResumeCount -gt 0) { $payload.resumeCount = $ResumeCount }
    if ($RecoveryReason) { $payload.recoveryReason = $RecoveryReason }
    $payload | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $runtimeDir "runtime.json")
}

function Read-RuntimeState {
    $runtimePath = Join-Path $runtimeDir "runtime.json"
    if (-not (Test-Path -LiteralPath $runtimePath)) { return $null }
    try { return Get-Content -LiteralPath $runtimePath -Raw | ConvertFrom-Json } catch { return $null }
}

function Get-OwnedRunDirectory {
    param([string]$Candidate)

    if (-not $Candidate) { return "" }
    try {
        $candidatePath = [IO.Path]::GetFullPath($Candidate).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
        $ownedRoot = [IO.Path]::GetFullPath($runsRoot).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    } catch { return "" }
    $ownedPrefix = $ownedRoot + [IO.Path]::DirectorySeparatorChar
    if (-not $candidatePath.StartsWith($ownedPrefix, [StringComparison]::OrdinalIgnoreCase)) { return "" }
    return $candidatePath
}

function Read-AgyError {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    $text = Get-Content -LiteralPath $Path -Raw -ErrorAction SilentlyContinue
    if (-not $text) { return $null }
    $index = $text.IndexOf("AGY_ERROR:")
    if ($index -lt 0) { return $null }
    $tail = $text.Substring($index + 10)

    $statusMatch = [regex]::Match($tail, '"(?:status|canonical_status)"\s*:\s*"([^"\r\n]+)"')
    $retryableMatch = [regex]::Match($tail, '"retryable"\s*:\s*(true|false)', [Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if (-not $statusMatch.Success -and -not $retryableMatch.Success) { return $null }

    return [pscustomobject]@{
        status = if ($statusMatch.Success) { $statusMatch.Groups[1].Value } else { "" }
        retryable = $retryableMatch.Success -and $retryableMatch.Groups[1].Value -ieq "true"
    }
}

function Write-RecoveryRecord {
    param([string]$RunId, [string]$Status, [string]$Message, [string]$RunDir, [string]$BaseHead = "", [string]$ConversationId = "")

    $payload = [ordered]@{
        recordedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        status = $Status
        runId = $RunId
        message = $Message
        runDir = $RunDir
    }
    if ($BaseHead) { $payload.baseHead = $BaseHead }
    if ($ConversationId) { $payload.conversationId = $ConversationId }
    $payload | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $logDir "$RunId.$Status.json")
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
    } else { "" }

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

function Invoke-NonInteractiveGit {
    param([string[]]$Arguments, [string]$WorkingDirectory)

    $previousGcmInteractive = $env:GCM_INTERACTIVE
    $previousTerminalPrompt = $env:GIT_TERMINAL_PROMPT
    try {
        $env:GCM_INTERACTIVE = "never"
        $env:GIT_TERMINAL_PROMPT = "0"
        Invoke-Checked "git" $Arguments $WorkingDirectory
    } finally {
        $env:GCM_INTERACTIVE = $previousGcmInteractive
        $env:GIT_TERMINAL_PROMPT = $previousTerminalPrompt
    }
}

function Read-State {
    param([string]$Path)
    return Get-Content $Path -Raw | ConvertFrom-Json
}

function Read-StateFromRef {
    param([string]$Ref)

    $spec = "${Ref}:data/research-state.json"
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

function Save-DataPatch {
    param([string]$RunDir, [string]$BaseHead, [string]$Destination)

    if (-not $RunDir -or -not (Test-Path -LiteralPath $RunDir) -or -not $BaseHead) { return }
    $patch = @(& git -C $RunDir diff --binary $BaseHead -- data 2>$null)
    if ($LASTEXITCODE -ne 0) { throw "Could not capture research data diff" }
    [IO.File]::WriteAllText(
        $Destination,
        [string]::Join([Environment]::NewLine, [string[]]$patch) + [Environment]::NewLine,
        [Text.UTF8Encoding]::new($false)
    )
}

$lock = Acquire-CycleLock
if ($null -eq $lock) {
    Write-Output "SKIP: already-running"
    exit 0
}

Recover-StaleRuntimeState

$runId = ""
$runDir = ""
$baseHead = ""
$resuming = $false
$resumeCount = 0
$conversationId = ""
$checkpoint = Read-RuntimeState

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

    $hasResumableCheckpoint = $checkpoint -and [string]$checkpoint.status -eq "resumable"
    if (-not $Force -and -not $hasResumableCheckpoint -and $state.nextRunAt -and [int64]$state.nextRunAt -gt $nowMs) {
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

    if ($hasResumableCheckpoint) {
        $checkpointRunDir = Get-OwnedRunDirectory ([string]$checkpoint.runDir)
        $checkpointBase = if ($checkpoint.PSObject.Properties["baseHead"]) { [string]$checkpoint.baseHead } else { "" }
        $checkpointConversation = if ($checkpoint.PSObject.Properties["conversationId"]) { [string]$checkpoint.conversationId } else { "" }
        $checkpointRunId = if ($checkpoint.runId) { [string]$checkpoint.runId } else { "unknown" }
        $checkpointValid = $checkpointRunDir -and (Test-Path -LiteralPath $checkpointRunDir) -and $checkpointBase -eq $baseHead -and $checkpointConversation

        if ($checkpointValid) {
            $runId = $checkpointRunId
            $runDir = $checkpointRunDir
            $conversationId = $checkpointConversation
            $resumeCount = if ($checkpoint.PSObject.Properties["resumeCount"]) { [int]$checkpoint.resumeCount + 1 } else { 1 }
            if ($checkpoint.PSObject.Properties["model"] -and $checkpoint.model) { $agyModel = [string]$checkpoint.model }
            & git -C $runDir merge-base --is-ancestor $baseHead HEAD
            if ($LASTEXITCODE -ne 0) { throw "Resumable cycle no longer descends from its base commit" }
            $cycleContextPath = Join-Path $runDir ".work\CYCLE_CONTEXT.md"
            if (-not (Test-Path -LiteralPath $cycleContextPath)) { throw "Resumable cycle lost its generated context" }
            $resuming = $true
            Write-Output "RESUME: run=$runId conversation=$conversationId attempt=$resumeCount"
        } else {
            $reason = if ($checkpointBase -and $checkpointBase -ne $baseHead) {
                "base advanced from $checkpointBase to $baseHead"
            } elseif (-not $checkpointConversation) {
                "checkpoint has no conversation id"
            } else {
                "checkpoint workspace is missing or invalid"
            }
            if ($checkpointRunDir -and (Test-Path -LiteralPath $checkpointRunDir)) {
                try { Save-DataPatch $checkpointRunDir $checkpointBase (Join-Path $logDir "$checkpointRunId.data.patch") } catch { Write-Warning $_.Exception.Message }
                try { Remove-RunDirectory $checkpointRunDir } catch { Write-Warning $_.Exception.Message }
            }
            Write-RecoveryRecord $checkpointRunId "abandoned" $reason $checkpointRunDir $checkpointBase $checkpointConversation
            Write-RuntimeState "abandoned" $checkpointRunId $reason "" $checkpointBase $checkpointConversation
            Write-Output "ABANDON RESUME: $reason"
        }
    }

    if (-not $resuming) {
        $runId = [DateTimeOffset]::UtcNow.ToString("yyyyMMddTHHmmssfffZ")
        $runDir = Join-Path $runsRoot $runId
        Invoke-Checked "git" @("clone", "--quiet", "--no-checkout", "--no-hardlinks", $repoRoot, $runDir) $repoRoot
        Invoke-Checked "git" @("-C", $runDir, "config", "core.autocrlf", "false") $runDir
        Invoke-Checked "git" @("-C", $runDir, "config", "core.safecrlf", "false") $runDir
        Invoke-Checked "git" @("-C", $runDir, "checkout", "--quiet", "--detach", $baseHead) $runDir
        Invoke-Checked "node" @((Join-Path $runDir "research\cli.mjs"), "check") $runDir

        $cycleContextDir = Join-Path $runDir ".work"
        $cycleContextPath = Join-Path $cycleContextDir "CYCLE_CONTEXT.md"
        New-Item -ItemType Directory -Force -Path $cycleContextDir | Out-Null
        Push-Location $runDir
        try {
            $contextOutput = & node "research\cli.mjs" "context" 2>&1
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
        Copy-Item -LiteralPath $cycleContextPath -Destination (Join-Path $logDir "$runId.context.md") -Force
    }

    $cycleRunMetadataPath = Join-Path $runDir ".work\CYCLE_RUN.json"
    $cycleRunMetadata = [ordered]@{
        runId = $runId
        baseHead = $baseHead
        model = $agyModel
    } | ConvertTo-Json
    [IO.File]::WriteAllText($cycleRunMetadataPath, $cycleRunMetadata + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))

    if ($Publish) {
        $remoteUrl = (& git -C $repoRoot remote get-url $RemoteName).Trim()
        if ($LASTEXITCODE -ne 0 -or -not $remoteUrl) { throw "Could not resolve remote URL for $RemoteName" }
        Invoke-Checked "git" @("-C", $runDir, "remote", "set-url", "origin", $remoteUrl) $runDir
        Invoke-NonInteractiveGit @("-C", $runDir, "push", "--dry-run", "origin", "${baseHead}:refs/heads/main") $runDir
    }

    $effectivePrompt = if ($resuming) {
        "Continue the interrupted BorderClash research cycle from this existing workspace and conversation. Preserve completed work, verify what remains, and finish the original cycle per AGENTS.md."
    } elseif ($Prompt) {
        $Prompt
    } else {
        # Do not prefix this with /goal. AGY 1.5.5 headless expands the command,
        # then exits before the first planner response.
        @'
Maintain the BorderClash data that powers the existing dashboard. Read AGENTS.md and .work/CYCLE_CONTEXT.md, then use the repository and web as useful. Treat the context as a snapshot of repository state, not ground truth. Leave the canonical record as accurate, current, well-sourced, and useful as the available evidence allows. Correct, add, merge, archive, or remove data when justified; a no-change cycle is valid. The runner has already passed preflight checks and will validate, generate, publish, and deploy afterward. Complete the cycle as described in AGENTS.md. End with <!-- GOAL_COMPLETE --> and always include an honest HARNESS_FEEDBACK review of any friction, missing context, constraint, or tool problem; use HARNESS_FEEDBACK: none only when there was genuinely no material issue.
'@
    }
    $attemptStem = if ($resuming) { "$runId.resume-$resumeCount" } else { $runId }
    [IO.File]::WriteAllText(
        (Join-Path $logDir "$attemptStem.prompt.txt"),
        $effectivePrompt.Trim() + [Environment]::NewLine,
        [Text.UTF8Encoding]::new($false)
    )

    $stdoutPath = Join-Path $logDir "$attemptStem.result.json"
    $stderrPath = Join-Path $logDir "$attemptStem.stderr.log"
    $agyLogPath = Join-Path $logDir "$attemptStem.agy.log"
    $runningMessage = if ($resuming) { "Antigravity cycle resumed" } else { "Antigravity cycle started" }
    Write-RuntimeState "running" $runId $runningMessage $runDir $baseHead $conversationId $resumeCount

    Push-Location $runDir
    $previousErrorAction = $ErrorActionPreference
    $previousConsoleEncoding = [Console]::OutputEncoding
    $previousOutputEncoding = $OutputEncoding
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $ErrorActionPreference = "Continue"
    try {
        [Console]::OutputEncoding = $utf8NoBom
        $OutputEncoding = $utf8NoBom
        $agyArgs = @()
        if ($resuming) { $agyArgs += @("--conversation", $conversationId) }
        $agyArgs += @("-p", $effectivePrompt, "--dangerously-skip-permissions", "--output-format", "json", "--model", $agyModel, "--print-timeout", "$($TimeoutMinutes)m", "--log-file", $agyLogPath)
        $stdout = @(& $agy @agyArgs 2> $stderrPath)
        $agyExit = $LASTEXITCODE
        [IO.File]::WriteAllText($stdoutPath, [string]::Join([Environment]::NewLine, [string[]]$stdout), $utf8NoBom)
    } finally {
        $ErrorActionPreference = $previousErrorAction
        [Console]::OutputEncoding = $previousConsoleEncoding
        $OutputEncoding = $previousOutputEncoding
        Pop-Location
    }

    $result = $null
    if ((Test-Path -LiteralPath $stdoutPath) -and (Get-Item -LiteralPath $stdoutPath).Length -gt 0) {
        try { $result = Get-Content $stdoutPath -Raw | ConvertFrom-Json } catch { }
    }
    $agyError = Read-AgyError $stderrPath
    if ($result -and $result.PSObject.Properties["conversation_id"] -and $result.conversation_id) {
        $conversationId = [string]$result.conversation_id
    }
    $finishedReason = if ($result -and $result.PSObject.Properties["finished_reason"]) { [string]$result.finished_reason } else { "" }
    $retryableProviderError = $agyError -and $agyError.PSObject.Properties["retryable"] -and [bool]$agyError.retryable
    $recoverable = ($finishedReason -eq "print_timeout") -or $retryableProviderError

    if ($recoverable -and $conversationId) {
        $recoveryReason = if ($finishedReason -eq "print_timeout") {
            "print_timeout"
        } elseif ($agyError.PSObject.Properties["status"] -and $agyError.status) {
            "retryable:$([string]$agyError.status)"
        } else {
            "retryable:provider"
        }
        Save-DataPatch $runDir $baseHead (Join-Path $logDir "$runId.data.patch")
        Write-RecoveryRecord $runId "resumable" $recoveryReason $runDir $baseHead $conversationId
        Write-RuntimeState "resumable" $runId "Cycle checkpointed after recoverable AGY interruption" $runDir $baseHead $conversationId $resumeCount $recoveryReason
        Write-Output "DEFERRED: $recoveryReason conversation=$conversationId run=$runId"
        exit 0
    }

    if ($agyExit -ne 0) {
        throw "Antigravity exited $agyExit. See $stdoutPath and $stderrPath"
    }
    if (-not $result) { throw "Antigravity did not return parseable JSON" }
    if ($result.status -ne "SUCCESS") {
        throw "Antigravity status was $($result.status)"
    }
    if (-not ([string]$result.response).Contains("<!-- GOAL_COMPLETE -->")) {
        throw "Antigravity did not confirm goal completion"
    }
    $feedback = [regex]::Match([string]$result.response, '(?m)^HARNESS_FEEDBACK:\s*(.+)$')
    $feedbackText = if ($feedback.Success) { $feedback.Groups[1].Value.Trim() } else { "missing" }
    [IO.File]::WriteAllText(
        (Join-Path $logDir "$runId.feedback.txt"),
        $feedbackText + [Environment]::NewLine,
        [Text.UTF8Encoding]::new($false)
    )
    if (-not $feedback.Success -or [string]::IsNullOrWhiteSpace($feedbackText)) {
        throw "Antigravity did not provide required HARNESS_FEEDBACK"
    }

    $runStatePath = Join-Path $runDir "data\research-state.json"
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

    Invoke-Checked "node" @((Join-Path $runDir "research\cli.mjs"), "check") $runDir
    Invoke-Checked "node" @((Join-Path $runDir "scripts\generate-public.mjs")) $runDir
    Invoke-Checked "git" @("-C", $runDir, "diff", "--check") $runDir

    Save-DataPatch $runDir $baseHead (Join-Path $logDir "$runId.data.patch")

    $cycleHead = (git -C $runDir rev-parse HEAD).Trim()
    $hasCommittedChanges = $cycleHead -ne $baseHead

    Invoke-Checked "git" @("-C", $runDir, "add", "-A") $runDir
    & git -C $runDir diff --cached --quiet 2>$null
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
        Invoke-Checked "git" @("-C", $runDir, "diff", "--cached", "--stat") $runDir
        Invoke-Checked "git" @(
            "-C", $runDir,
            "-c", "user.name=BorderClash Research",
            "-c", "user.email=borderclash-research@local.invalid",
            "commit", "-m", "research: complete BorderClash cycle ($runId)"
        ) $runDir
    }
    $cycleCommit = (git -C $runDir rev-parse HEAD).Trim()

    if (-not $Publish) {
        Remove-RunDirectory $runDir
        Write-RuntimeState "validated" $runId "Shadow cycle passed; publication disabled" ""
        Write-Output "SHADOW SUCCESS: conversation=$($result.conversation_id)"
        Write-Output "commit=$cycleCommit"
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
    Invoke-NonInteractiveGit @("-C", $runDir, "push", "origin", "${cycleCommit}:refs/heads/main") $runDir

    $publishedRunDir = ""
    try { Remove-RunDirectory $runDir } catch { Write-Warning $_.Exception.Message; $publishedRunDir = $runDir }
    Write-RuntimeState "published" $runId "Published validated cycle $cycleCommit" $publishedRunDir
    Write-Output "PUBLISHED: $cycleCommit conversation=$($result.conversation_id)"
}
catch {
    $message = $_.Exception.Message
    $runtimeRunDir = $runDir
    if ($runDir -and (Test-Path -LiteralPath $runDir)) {
        try { Save-DataPatch $runDir $baseHead (Join-Path $logDir "$runId.data.patch") } catch { Write-Warning $_.Exception.Message }
        try { Remove-RunDirectory $runDir } catch { Write-Warning $_.Exception.Message }
        if (-not (Test-Path -LiteralPath $runDir)) { $runtimeRunDir = "" }
    }
    Write-RuntimeState "failed" $runId $message $runtimeRunDir
    Write-Error $message
    exit 1
}
finally {
    if ($lock) {
        try { $lock.ReleaseMutex() } catch { }
        $lock.Dispose()
    }
}
