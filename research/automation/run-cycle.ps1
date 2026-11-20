param(
    [switch]$Force,
    [switch]$Publish,
    [string]$RemoteName = "origin",
    [int]$TimeoutMinutes = 0,
    [string]$Prompt = "",
    [string]$AgyPath = "",
    [string]$RunsRoot = "",
    [string]$RuntimeDir = "",
    [string]$LogDir = "",
    [string]$MutexName = "Global\BorderClashResearchCycle",
    [string]$PublicBaseUrl = "https://border-clash.vercel.app",
    [int]$DeliveryTimeoutSeconds = 600,
    [int]$DeliveryPollMilliseconds = 15000,
    [int]$StartLeadMinutes = 0
)

. (Join-Path $PSScriptRoot "platform.ps1")

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$productionModel = "gemini-3.8-flash-medium"
$runnerProcess = Get-Process -Id $PID
[DateTimeOffset]$runnerProcessStarted = $runnerProcess.StartTime
$runnerStartedAt = $runnerProcessStarted.ToUnixTimeMilliseconds()

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$runnerRoot = Join-Path $repoRoot ".work\runner"
$runtimeDir = if ($RuntimeDir) { [IO.Path]::GetFullPath($RuntimeDir) } else { Join-Path $runnerRoot "runtime" }
$logDir = if ($LogDir) { [IO.Path]::GetFullPath($LogDir) } else { Join-Path $runnerRoot "logs" }
$runsRoot = if ($RunsRoot) { [IO.Path]::GetFullPath($RunsRoot) } else { Join-Path $runnerRoot "runs" }
$pendingPublicationPath = Join-Path $runtimeDir "pending-publication.json"
$trustedResearchCli = Join-Path $repoRoot "research\cli.mjs"
$agyModel = $productionModel
$isFakeAgent = -not [string]::IsNullOrWhiteSpace($AgyPath)
if (-not $isFakeAgent -and -not [string]::Equals($script:ResearchMachine, "SouthServer", [StringComparison]::OrdinalIgnoreCase)) {
    throw "Real BorderClash research may run only on SouthServer."
}

New-Item -ItemType Directory -Force -Path $runtimeDir, $logDir, $runsRoot | Out-Null

function Write-JsonAtomicFile {
    param([string]$Path, $Value)

    $parent = Split-Path -Parent $Path
    if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    $temp = "$Path.$PID.$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()).tmp"
    $json = $Value | ConvertTo-Json -Depth 30
    [IO.File]::WriteAllText($temp, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temp -Destination $Path -Force
}

function Write-RuntimeState {
    param(
        [string]$Status,
        [string]$RunId,
        [string]$Message,
        [string]$RunDir = "",
        [string]$BaseHead = "",
        [string]$ConversationId = "",
        [int]$ResumeCount = 0,
        [string]$RecoveryReason = "",
        [string]$StateModel = "",
        [hashtable]$Extra = $null
    )
    $payload = [ordered]@{
        updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        status = $Status
        phase = $Status
        runId = $RunId
        model = if ($StateModel) { $StateModel } else { $agyModel }
        message = $Message
        runDir = $RunDir
    }
    if ($Status -eq "running") {
        $payload.runnerPid = $PID
        $payload.runnerStartedAt = $runnerStartedAt
    }
    if ($BaseHead) { $payload.baseHead = $BaseHead }
    if ($ConversationId) { $payload.conversationId = $ConversationId }
    if ($ResumeCount -gt 0) { $payload.resumeCount = $ResumeCount }
    if ($RecoveryReason) { $payload.recoveryReason = $RecoveryReason }
    if ($Extra) {
        foreach ($key in $Extra.Keys) { $payload[$key] = $Extra[$key] }
    }
    Write-JsonAtomicFile (Join-Path $runtimeDir "runtime.json") $payload
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
    Write-JsonAtomicFile (Join-Path $logDir "$RunId.$Status.json") $payload
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

function Test-ProcessInstanceActive {
    param([int]$ProcessId, [int64]$StartedAtMs)

    if ($ProcessId -le 0 -or $StartedAtMs -le 0) { return $false }
    try {
        $process = Get-Process -Id $ProcessId -ErrorAction Stop
        [DateTimeOffset]$started = $process.StartTime
        return [Math]::Abs($started.ToUnixTimeMilliseconds() - $StartedAtMs) -lt 15000
    } catch {
        return $false
    }
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
    $previousBaseHead = if ($previous.PSObject.Properties["baseHead"] -and $previous.baseHead) { [string]$previous.baseHead } else { "" }
    $previousConversation = if ($previous.PSObject.Properties["conversationId"] -and $previous.conversationId) { [string]$previous.conversationId } else { "" }
    $previousResumeCount = if ($previous.PSObject.Properties["resumeCount"]) { [int]$previous.resumeCount } else { 0 }
    $previousModel = if ($previous.PSObject.Properties["model"] -and $previous.model) { [string]$previous.model } else { $agyModel }
    $candidate = Get-OwnedRunDirectory $previousRunDir
    $session = $null

    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
        $sessionPath = Join-Path $candidate ".work\AGY_SESSION.json"
        if (Test-Path -LiteralPath $sessionPath) {
            try {
                $session = Get-Content -LiteralPath $sessionPath -Raw | ConvertFrom-Json
                if (-not $previousConversation -and $session.conversationId) { $previousConversation = [string]$session.conversationId }
            } catch { }
        }
    }

    if (
        $session -and
        [string]$session.status -eq "running" -and
        $session.PSObject.Properties["agyPid"] -and
        $session.PSObject.Properties["agyStartedAt"] -and
        (Test-ProcessInstanceActive ([int]$session.agyPid) ([int64]$session.agyStartedAt))
    ) {
        Write-RuntimeState "running" $previousRunId "Previous runner ended but its AGY process is still active" $candidate $previousBaseHead $previousConversation $previousResumeCount "runner_detached" $previousModel
        return "active"
    }

    $sessionStatus = if ($session -and $session.PSObject.Properties["status"]) { [string]$session.status } else { "" }
    $sessionSucceeded = (
        $sessionStatus -eq "success" -and
        $session.PSObject.Properties["result"] -and
        $session.result -and
        [string]$session.result.status -eq "SUCCESS"
    )

    $interrupted = [ordered]@{
        detectedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        status = "interrupted"
        runId = $previousRunId
        message = "Previous runner ended without a final status; the cycle mutex is no longer owned."
        runDir = $previousRunDir
        baseHead = $previousBaseHead
        conversationId = $previousConversation
    }
    Write-JsonAtomicFile (Join-Path $logDir "$previousRunId.interrupted.json") $interrupted

    if ($candidate -and (Test-Path -LiteralPath $candidate) -and $previousConversation -and $previousBaseHead -and $sessionSucceeded) {
        Write-RuntimeState "ready" $previousRunId "Recovered a completed AGY turn that still needs validation" $candidate $previousBaseHead $previousConversation $previousResumeCount "runner_interrupted_after_success" $previousModel
        return
    }

    if ($candidate -and (Test-Path -LiteralPath $candidate) -and $sessionStatus -eq "error") {
        try { Save-DataPatch $candidate $previousBaseHead (Join-Path $logDir "$previousRunId.data.patch") } catch { Write-Warning $_.Exception.Message }
        Write-RuntimeState "review" $previousRunId "Recovered a terminal AGY failure; workspace preserved for operator review" $candidate $previousBaseHead $previousConversation $previousResumeCount "runner_interrupted_after_error" $previousModel @{
            workspaceUsable = $true
            conversationResumable = $false
        }
        return "review"
    }

    if (
        $candidate -and
        (Test-Path -LiteralPath $candidate) -and
        $previousConversation -and
        $previousBaseHead -and
        $sessionStatus -in @("", "running", "recoverable")
    ) {
        Write-RuntimeState "resumable" $previousRunId "Recovered interrupted runner from its streamed AGY conversation" $candidate $previousBaseHead $previousConversation $previousResumeCount "runner_interrupted" $previousModel @{
            workspaceUsable = $true
            conversationResumable = $true
        }
        return
    }

    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
        try { Save-DataPatch $candidate $previousBaseHead (Join-Path $logDir "$previousRunId.data.patch") } catch { Write-Warning $_.Exception.Message }
        Write-RuntimeState "review" $previousRunId "Recovered interrupted work before an AGY conversation checkpoint; workspace preserved" $candidate $previousBaseHead $previousConversation $previousResumeCount "runner_interrupted_before_checkpoint" $previousModel @{
            workspaceUsable = $true
            conversationResumable = $false
        }
        return "review"
    }

    Write-RuntimeState "interrupted" $previousRunId "Recovered stale running state without a workspace" "" $previousBaseHead "" $previousResumeCount "" $previousModel
}

function Invoke-Checked {
    param([string]$File, [string[]]$Arguments, [string]$WorkingDirectory)

    Push-Location $WorkingDirectory
    $previousErrorAction = $ErrorActionPreference
    try {
        # Native tools can emit warnings on stderr while returning success
        # (notably Git's line-ending notices). Trust the process exit code.
        $ErrorActionPreference = "Continue"
        & $File @Arguments
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorAction
        Pop-Location
    }
    if ($exitCode -ne 0) {
        throw "$File exited with code $exitCode"
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

function Assert-AgentDidNotEditResearchState {
    param([string]$RunDir, [string]$BaseHead)

    $previousErrorAction = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        & git -C $RunDir diff --quiet $BaseHead -- data/research-state.json 2>$null
        $diffExit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorAction
    }
    if ($diffExit -eq 1) {
        throw "Agent changed runner-owned data/research-state.json; operator review required."
    }
    if ($diffExit -ne 0) {
        throw "Could not verify runner-owned research state against the cycle base."
    }
}

function New-CompletedResearchState {
    param($BaseState, $Completion)

    $result = [ordered]@{}
    foreach ($property in $BaseState.PSObject.Properties) { $result[$property.Name] = $property.Value }
    $result["isPaused"] = [bool]$BaseState.isPaused
    $result["systemStatus"] = "online"
    $result["lastResearchAt"] = [int64]$Completion.completedAt
    $result["nextRunAt"] = [int64]$Completion.nextRunAt
    $result["lastCycleInterval"] = [double]$Completion.intervalHours
    $result["schedulingReason"] = [string]$Completion.reason
    $result["researchCycleCount"] = [int64]$Completion.researchCycleCount
    $result["scheduler"] = "external"
    return [pscustomobject]$result
}

function Test-ResearchStateEquivalent {
    param($Left, $Right)

    if ($null -eq $Left -or $null -eq $Right) { return $false }
    $leftNames = @($Left.PSObject.Properties.Name | Sort-Object)
    $rightNames = @($Right.PSObject.Properties.Name | Sort-Object)
    if (($leftNames -join [char]0) -ne ($rightNames -join [char]0)) { return $false }
    foreach ($name in $leftNames) {
        $leftValue = $Left.$name | ConvertTo-Json -Depth 30 -Compress
        $rightValue = $Right.$name | ConvertTo-Json -Depth 30 -Compress
        if ($leftValue -ne $rightValue) { return $false }
    }
    return $true
}

function Get-OrCreateRunnerCompletion {
    param(
        [string]$RunDir,
        [string]$RunId,
        [string]$BaseHead,
        $BaseState,
        $FinishMarker
    )

    $path = Join-Path $logDir "$RunId.completion.json"
    $hours = [double]$FinishMarker.intervalHours
    if ($hours -lt 1 -or $hours -gt 168) { throw "Research finish interval is outside 1..168 hours" }
    $reason = [string]$FinishMarker.reason
    if ([string]::IsNullOrWhiteSpace($reason)) { throw "Research finish reason is missing" }

    if (Test-Path -LiteralPath $path) {
        $completion = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
        if ([string]$completion.cycleId -ne $RunId) { throw "Runner completion marker belongs to another cycle" }
        if ([string]$completion.baseHead -ne $BaseHead) { throw "Runner completion marker has a different cycle base" }
        if ([double]$completion.intervalHours -ne $hours) { throw "Runner completion marker cadence no longer matches agent finish intent" }
        if ([string]$completion.reason -ne $reason) { throw "Runner completion marker reason no longer matches agent finish intent" }
        if ([int64]$completion.researchCycleCount -ne ([int64]$BaseState.researchCycleCount + 1)) {
            throw "Runner completion marker has an invalid cycle count"
        }
        if ([int64]$completion.completedAt -le [int64]$BaseState.lastResearchAt) {
            throw "Runner completion marker does not advance completion time"
        }
        if ([int64]$completion.nextRunAt -le [int64]$completion.completedAt) {
            throw "Runner completion marker does not schedule a future target"
        }
        $currentState = Read-State (Join-Path $RunDir "data\research-state.json")
        $expectedState = New-CompletedResearchState $BaseState $completion
        if (
            -not (Test-ResearchStateEquivalent $currentState $BaseState) -and
            -not (Test-ResearchStateEquivalent $currentState $expectedState)
        ) {
            throw "Agent changed runner-owned data/research-state.json; trusted completion state no longer matches."
        }
        return $completion
    }

    Assert-AgentDidNotEditResearchState $RunDir $BaseHead
    $completedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    if ($completedAt -le [int64]$BaseState.lastResearchAt) {
        $completedAt = [int64]$BaseState.lastResearchAt + 1
    }
    $completion = [ordered]@{
        schemaVersion = 1
        cycleId = $RunId
        baseHead = $BaseHead
        completedAt = $completedAt
        nextRunAt = $completedAt + [int64][Math]::Round($hours * 3600000)
        intervalHours = $hours
        reason = $reason
        researchCycleCount = [int64]$BaseState.researchCycleCount + 1
    }
    Write-JsonAtomicFile $path $completion
    return (Get-Content -LiteralPath $path -Raw | ConvertFrom-Json)
}

function Assert-ResearchOnlyPaths {
    param([string]$RunDir, [string]$BaseHead)

    $previousErrorAction = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $paths = @()
        $paths += @(& git -C $RunDir diff --name-only $BaseHead -- 2>$null)
        $diffExit = $LASTEXITCODE
        $paths += @(& git -C $RunDir ls-files --others --exclude-standard 2>$null)
        $untrackedExit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorAction
    }
    if ($diffExit -ne 0) { throw "Could not inspect cycle diff paths" }
    if ($untrackedExit -ne 0) { throw "Could not inspect untracked cycle paths" }

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
    if (Test-Path -LiteralPath $RunDir) { throw "Could not remove run directory $RunDir" }
}

function Save-DataPatch {
    param([string]$RunDir, [string]$BaseHead, [string]$Destination)

    if (-not $RunDir -or -not (Test-Path -LiteralPath $RunDir) -or -not $BaseHead) { return }
    $previousErrorAction = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        & git -C $RunDir add -N -- data 2>$null
        $addExit = $LASTEXITCODE
        $patch = @(& git -C $RunDir diff --binary $BaseHead -- data 2>$null)
        $diffExit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorAction
    }
    if ($addExit -notin @(0, 1)) { throw "Could not stage intent-to-add for recovery patch" }
    if ($diffExit -ne 0) { throw "Could not capture research data diff" }
    [IO.File]::WriteAllText(
        $Destination,
        [string]::Join([Environment]::NewLine, [string[]]$patch) + [Environment]::NewLine,
        [Text.UTF8Encoding]::new($false)
    )
}

function Invoke-EvidenceCapture {
    param([string]$RunDir, [string]$BaseHead, [string]$RunId)

    if (-not $RunDir -or -not $BaseHead -or -not $RunId) { return }
    $captureLog = Join-Path $logDir "$RunId.capture.json"
    $previousErrorAction = $ErrorActionPreference
    Push-Location $RunDir
    try {
        $ErrorActionPreference = "Continue"
        $output = @(& node $trustedResearchCli "capture-changed" $BaseHead 2>&1)
        $captureExit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorAction
        Pop-Location
    }
    [IO.File]::WriteAllText(
        $captureLog,
        [string]::Join([Environment]::NewLine, [string[]]$output) + [Environment]::NewLine,
        [Text.UTF8Encoding]::new($false)
    )
    if ($captureExit -eq 3) {
        throw "Evidence identity review required for a manually edited article. See $captureLog"
    }
    if ($captureExit -ne 0) {
        Write-Warning "Evidence capture could not complete; canonical validation will continue. See $captureLog"
    }
}

function Invoke-PublicationTool {
    param([string]$Command, [string[]]$Arguments)

    $publisher = Join-Path $repoRoot "research\automation\publish-candidate.mjs"
    $output = @(& node $publisher $Command @Arguments 2>&1)
    if ($LASTEXITCODE -ne 0) {
        $detail = [string]::Join([Environment]::NewLine, [string[]]$output).Trim()
        if (-not $detail) { $detail = "no diagnostic output" }
        throw ("Publication helper failed in " + $Command + ": " + $detail)
    }
    $line = [string]($output | Select-Object -Last 1)
    if ([string]::IsNullOrWhiteSpace($line)) { throw "Publication helper returned no result" }
    return $line | ConvertFrom-Json
}

function Get-PublicDashboardUrl {
    return $PublicBaseUrl.TrimEnd("/") + "/data/dashboard.json"
}

function Get-PublicationResumeArgs {
    return @(
        "--repo-root", $repoRoot,
        "--remote-name", $RemoteName,
        "--candidate-root", $runsRoot,
        "--pending-path", $pendingPublicationPath,
        "--public-url", (Get-PublicDashboardUrl),
        "--timeout-ms", [string][Math]::Max(0, $DeliveryTimeoutSeconds * 1000),
        "--interval-ms", [string][Math]::Max(100, $DeliveryPollMilliseconds)
    )
}

function Set-PublicationRuntime {
    param($Publication, [string]$ConversationId = "", [int]$ResumeCount = 0)

    $pubRunId = [string]$Publication.runId
    $pubRunDir = if ($Publication.PSObject.Properties["sourceRunDir"]) {
        [string]$Publication.sourceRunDir
    } else { "" }
    $pubBase = if ($Publication.PSObject.Properties["baseHead"]) { [string]$Publication.baseHead } else { "" }

    if ([string]$Publication.status -eq "verified") {
        Write-JsonAtomicFile (Join-Path $logDir "$pubRunId.delivery.json") $Publication
        Remove-Item -LiteralPath $pendingPublicationPath -Force -ErrorAction SilentlyContinue
        Write-RuntimeState "published" $pubRunId "Public dashboard verified for $($Publication.candidateCommit)" $pubRunDir $pubBase $ConversationId $ResumeCount "" "" @{
            publishCandidate = [string]$Publication.candidateDir
            publishCommit = [string]$Publication.candidateCommit
            verifiedAt = [int64]$Publication.verifiedAt
            servedCommit = [string]$Publication.servedCommit
        }
        return "PUBLIC VERIFIED: $($Publication.candidateCommit) served=$($Publication.servedCommit)"
    }

    if ([string]$Publication.status -eq "review") {
        $reason = if ($Publication.reason) { [string]$Publication.reason } else { "Publication requires operator review." }
        Write-RuntimeState "review" $pubRunId $reason $pubRunDir $pubBase $ConversationId $ResumeCount "publication_review" "" @{
            publishCandidate = if ($Publication.PSObject.Properties["candidateDir"]) { [string]$Publication.candidateDir } else { "" }
            publishCommit = if ($Publication.PSObject.Properties["candidateCommit"]) { [string]$Publication.candidateCommit } else { "" }
        }
        return "REVIEW HOLD: $reason"
    }

    $message = if ($Publication.lastError) {
        "Git accepted the candidate; public delivery is still pending: $([string]$Publication.lastError)"
    } else {
        "Git accepted the candidate; waiting for the public dashboard."
    }
    Write-RuntimeState "pending-publication" $pubRunId $message $pubRunDir $pubBase $ConversationId $ResumeCount "awaiting_public" "" @{
        publishCandidate = [string]$Publication.candidateDir
        publishCommit = [string]$Publication.candidateCommit
    }
    return "PENDING PUBLICATION: $($Publication.candidateCommit)"
}
$lock = Acquire-CycleLock
if ($null -eq $lock) {
    Write-Output "SKIP: already-running"
    exit 0
}

if ($Publish -and (Test-Path -LiteralPath $pendingPublicationPath)) {
    try {
        $savedPublication = Read-State $pendingPublicationPath
        $publication = if ([string]$savedPublication.status -in @("verified", "review")) {
            $savedPublication
        } else {
            Invoke-PublicationTool "resume" (Get-PublicationResumeArgs)
        }
        $existingRuntime = Read-RuntimeState
        $savedConversation = if ($existingRuntime -and $existingRuntime.PSObject.Properties["conversationId"]) { [string]$existingRuntime.conversationId } else { "" }
        $savedResumeCount = if ($existingRuntime -and $existingRuntime.PSObject.Properties["resumeCount"]) { [int]$existingRuntime.resumeCount } else { 0 }
        Write-Output (Set-PublicationRuntime $publication $savedConversation $savedResumeCount)
    } catch {
        $message = $_.Exception.Message
        $saved = if (Test-Path -LiteralPath $pendingPublicationPath) { Read-State $pendingPublicationPath } else { $null }
        $savedRunId = if ($saved -and $saved.runId) { [string]$saved.runId } else { "" }
        $savedRunDir = if ($saved -and $saved.sourceRunDir) { [string]$saved.sourceRunDir } else { "" }
        $savedBase = if ($saved -and $saved.baseHead) { [string]$saved.baseHead } else { "" }
        Write-RuntimeState "review" $savedRunId $message $savedRunDir $savedBase "" 0 "publication_review"
        Write-Error $message
        exit 1
    }
    exit 0
}

$staleRecovery = Recover-StaleRuntimeState
if ($staleRecovery -eq "active") {
    Write-Output "SKIP: detached AGY process still running"
    exit 0
} elseif ($staleRecovery -eq "review") {
    Write-Output "REVIEW HOLD: interrupted cycle ended with a terminal AGY error"
    exit 0
}

$runId = ""
$runDir = ""
$baseHead = ""
$cycleStartedAt = $runnerStartedAt
$resuming = $false
$recoveringCompletedTurn = $false
$resumeCount = 0
$conversationId = ""
$agySession = $null
$checkpoint = Read-RuntimeState

if ($checkpoint -and [string]$checkpoint.status -eq "review") {
    Write-Output "REVIEW HOLD: $([string]$checkpoint.message)"
    exit 0
}

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

    $hasRecoveryCheckpoint = $checkpoint -and [string]$checkpoint.status -in @("resumable", "ready")
    $leadMs = [int64][Math]::Max(0, $StartLeadMinutes) * 60 * 1000
    if (-not $Force -and -not $hasRecoveryCheckpoint -and $state.nextRunAt -and ([int64]$state.nextRunAt - $leadMs) -gt $nowMs) {
        $next = [DateTimeOffset]::FromUnixTimeMilliseconds([int64]$state.nextRunAt).ToLocalTime()
        Write-Output "SKIP: not-due nextRunAt=$($next.ToString('o')) lead=$StartLeadMinutes minutes"
        exit 0
    }

    if ($Publish) {
        Write-Output "PRODUCTION BASE: $baseHead ($baseRef)"
    }

    if ($hasRecoveryCheckpoint) {
        $checkpointRunDir = Get-OwnedRunDirectory ([string]$checkpoint.runDir)
        $checkpointBase = if ($checkpoint.PSObject.Properties["baseHead"]) { [string]$checkpoint.baseHead } else { "" }
        $checkpointConversation = if ($checkpoint.PSObject.Properties["conversationId"]) { [string]$checkpoint.conversationId } else { "" }
        $checkpointRunId = if ($checkpoint.runId) { [string]$checkpoint.runId } else { "unknown" }
        $checkpointValid = $checkpointRunDir -and (Test-Path -LiteralPath $checkpointRunDir) -and $checkpointBase -and $checkpointConversation

        if ($checkpointValid) {
            $latestBaseHead = $baseHead
            $runId = $checkpointRunId
            $runDir = $checkpointRunDir
            $conversationId = $checkpointConversation
            $baseHead = $checkpointBase
            $state = Read-StateFromRef $baseHead
            $recoveringCompletedTurn = [string]$checkpoint.status -eq "ready"
            $checkpointResumeCount = if ($checkpoint.PSObject.Properties["resumeCount"]) { [int]$checkpoint.resumeCount } else { 0 }
            $resumeCount = if ($recoveringCompletedTurn) { $checkpointResumeCount } else { $checkpointResumeCount + 1 }
            if ($checkpoint.PSObject.Properties["model"] -and $checkpoint.model) {
                $checkpointModel = [string]$checkpoint.model
                if ($recoveringCompletedTurn) {
                    $agyModel = $checkpointModel
                } elseif ($checkpointModel -ne $productionModel) {
                    $message = "Saved conversation requires model '$checkpointModel'; production requires '$productionModel'. Workspace preserved."
                    Write-RuntimeState "review" $runId $message $runDir $baseHead $conversationId $resumeCount "model_incompatible" $checkpointModel @{
                        workspaceUsable = $true
                        conversationResumable = $false
                    }
                    Write-RecoveryRecord $runId "review" $message $runDir $baseHead $conversationId
                    Write-Output "REVIEW HOLD: $message"
                    exit 0
                }
            }
            & git -C $runDir merge-base --is-ancestor $baseHead HEAD
            if ($LASTEXITCODE -ne 0) { throw "Resumable cycle no longer descends from its base commit" }
            $cycleContextPath = Join-Path $runDir ".work\CYCLE_CONTEXT.md"
            if (-not (Test-Path -LiteralPath $cycleContextPath)) { throw "Resumable cycle lost its generated context" }
            if ($recoveringCompletedTurn) {
                Write-Output "RECOVER: run=$runId completed AGY turn; validating without another model call"
            } else {
                $resuming = $true
                if ($latestBaseHead -ne $baseHead) {
                    Write-Output "RESUME: run=$runId conversation=$conversationId attempt=$resumeCount originalBase=$baseHead latestBase=$latestBaseHead"
                } else {
                    Write-Output "RESUME: run=$runId conversation=$conversationId attempt=$resumeCount"
                }
            }
        } else {
            $reason = if (-not $checkpointConversation) {
                "checkpoint has no conversation id"
            } else {
                "checkpoint workspace is missing or invalid"
            }
            if ($checkpointRunDir -and (Test-Path -LiteralPath $checkpointRunDir)) {
                try { Save-DataPatch $checkpointRunDir $checkpointBase (Join-Path $logDir "$checkpointRunId.data.patch") } catch { Write-Warning $_.Exception.Message }
            }
            Write-RecoveryRecord $checkpointRunId "review" $reason $checkpointRunDir $checkpointBase $checkpointConversation
            Write-RuntimeState "review" $checkpointRunId $reason $checkpointRunDir $checkpointBase $checkpointConversation
            Write-Output "REVIEW HOLD: $reason"
            exit 0
        }
    }

    if (-not $resuming -and -not $recoveringCompletedTurn) {
        $runId = [DateTimeOffset]::UtcNow.ToString("yyyyMMddTHHmmssfffZ")
        $runDir = Join-Path $runsRoot $runId
        Invoke-Checked "git" @("clone", "--quiet", "--no-checkout", "--no-hardlinks", $repoRoot, $runDir) $repoRoot
        Invoke-Checked "git" @("-C", $runDir, "config", "core.autocrlf", "false") $runDir
        Invoke-Checked "git" @("-C", $runDir, "config", "core.safecrlf", "false") $runDir
        Invoke-Checked "git" @("-C", $runDir, "checkout", "--quiet", "--detach", $baseHead) $runDir
        Invoke-Checked "node" @($trustedResearchCli, "check") $runDir

        $cycleContextDir = Join-Path $runDir ".work"
        $cycleContextPath = Join-Path $cycleContextDir "CYCLE_CONTEXT.md"
        New-Item -ItemType Directory -Force -Path $cycleContextDir | Out-Null
        Push-Location $runDir
        try {
            $contextOutput = & node $trustedResearchCli "context" 2>&1
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
    if (Test-Path -LiteralPath $cycleRunMetadataPath) {
        try {
            $existingCycleRunMetadata = Get-Content -LiteralPath $cycleRunMetadataPath -Raw | ConvertFrom-Json
            if (
                [string]$existingCycleRunMetadata.runId -eq $runId -and
                $existingCycleRunMetadata.PSObject.Properties["startedAt"] -and
                [int64]$existingCycleRunMetadata.startedAt -gt 0
            ) {
                $cycleStartedAt = [int64]$existingCycleRunMetadata.startedAt
            }
        } catch {
            throw "Cycle metadata is unreadable during recovery"
        }
    }
    $cycleRunMetadata = [ordered]@{
        runId = $runId
        baseHead = $baseHead
        model = $agyModel
        startedAt = $cycleStartedAt
    } | ConvertTo-Json
    [IO.File]::WriteAllText($cycleRunMetadataPath, $cycleRunMetadata + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))

    $result = $null
    if ($recoveringCompletedTurn) {
        $sessionPath = Join-Path $runDir ".work\AGY_SESSION.json"
        if (-not (Test-Path -LiteralPath $sessionPath)) { throw "Completed AGY recovery lost its session state" }
        $agySession = Get-Content -LiteralPath $sessionPath -Raw | ConvertFrom-Json
        if ([string]$agySession.status -ne "success" -or -not $agySession.result) {
            throw "Completed AGY recovery no longer has a successful terminal result"
        }
        $result = $agySession.result
    } else {
        $agyCommand = Get-Command agy -ErrorAction SilentlyContinue
        $agy = if ($AgyPath) {
            (Resolve-Path $AgyPath).Path
        } elseif ($agyCommand) {
            $agyCommand.Source
        } else {
            Resolve-ResearchAgent
        }
        if (-not (Test-Path $agy)) { throw "Antigravity CLI not found" }

        $continuationPrompt = "Continue the interrupted BorderClash research cycle from this existing workspace and conversation. Preserve completed work, verify what remains, and finish the original cycle per AGENTS.md."
        $postCycleExpectation = if ($Publish) {
            "The runner has already passed preflight checks and will validate, generate, publish, and verify public delivery afterward."
        } else {
            "The runner has already passed preflight checks and will validate and generate afterward. Publication is disabled for this supervised cycle."
        }
        $effectivePrompt = if ($resuming) {
            $continuationPrompt
        } elseif ($Prompt) {
            $Prompt
        } else {
            # Do not prefix this with /goal. AGY 1.5.5 headless expands the command,
            # then exits before the first planner response.
            @"
Maintain the BorderClash data that powers the existing dashboard. Read AGENTS.md and .work/CYCLE_CONTEXT.md, then use the repository and web as useful. Treat the context as a snapshot of repository state, not ground truth. Your deliverable is canonical data/ only. Report harness problems through feedback and use research finish --review when they prevent a trustworthy result. Leave the canonical record as accurate, current, well-sourced, and useful as the available evidence allows. Correct, add, merge, archive, or remove data when justified; a no-change cycle is valid. $postCycleExpectation Complete the cycle as described in AGENTS.md. End with <!-- GOAL_COMPLETE --> and always include an honest HARNESS_FEEDBACK review of any friction, missing context, constraint, or tool problem; use HARNESS_FEEDBACK: none only when there was genuinely no material issue.
"@
        }
        $attemptStem = if ($resuming) { "$runId.resume-$resumeCount" } else { $runId }
        $promptPath = Join-Path $logDir "$attemptStem.prompt.txt"
        $continuationPromptPath = Join-Path $logDir "$attemptStem.continuation.txt"
        $resultPath = Join-Path $logDir "$attemptStem.result.json"
        $eventsPath = Join-Path $logDir "$attemptStem.events.ndjson"
        $stderrPath = Join-Path $logDir "$attemptStem.stderr.log"
        $agyLogBase = Join-Path $logDir "$attemptStem.agy"
        $sessionPath = Join-Path $runDir ".work\AGY_SESSION.json"
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [IO.File]::WriteAllText($promptPath, $effectivePrompt.Trim() + [Environment]::NewLine, $utf8NoBom)
        [IO.File]::WriteAllText($continuationPromptPath, $continuationPrompt + [Environment]::NewLine, $utf8NoBom)

        $runningMessage = if ($resuming) { "Antigravity cycle resumed" } else { "Antigravity cycle started" }
        Write-RuntimeState "running" $runId $runningMessage $runDir $baseHead $conversationId $resumeCount

        $supervisor = Join-Path $repoRoot "research\automation\agy-supervisor.mjs"
        $settingsPath = Join-Path $logDir "$attemptStem.settings.json"
        $evidenceRoot = if ($env:BORDERCLASH_EVIDENCE_ARCHIVE) {
            $env:BORDERCLASH_EVIDENCE_ARCHIVE
        } else {
            Join-Path ([Environment]::GetFolderPath("UserProfile")) ".borderclash/evidence"
        }
        $backupRoot = if ($env:BORDERCLASH_EVIDENCE_BACKUP) {
            $env:BORDERCLASH_EVIDENCE_BACKUP
        } else {
            Join-Path ([Environment]::GetFolderPath("UserProfile")) ".borderclash/evidence-backup"
        }
        Write-JsonAtomicFile $settingsPath @{
            permissions = @{
                allow = @("read_url(*)", "write_file($evidenceRoot)", "write_file($backupRoot)")
            }
        }
        $supervisorArgs = @(
            $supervisor,
            "--agy", $agy,
            "--cwd", $runDir,
            "--model", $agyModel,
            "--settings-file", $settingsPath,
            "--prompt-file", $promptPath,
            "--continuation-prompt-file", $continuationPromptPath,
            "--result-file", $resultPath,
            "--events-file", $eventsPath,
            "--stderr-file", $stderrPath,
            "--session-file", $sessionPath,
            "--agy-log-base", $agyLogBase,
            "--timeout-minutes", [string]$TimeoutMinutes,
            "--stuck-minutes", $(if ($isFakeAgent) { "0" } else { "90" }),
            "--retry-delay-ms", $(if ($isFakeAgent) { "0" } else { "30000" })
        )
        if ($conversationId) { $supervisorArgs += @("--conversation", $conversationId) }
        $previousTrustedResearchCli = $env:BORDERCLASH_TRUSTED_RESEARCH_CLI
        try {
            if ($isFakeAgent) { $env:BORDERCLASH_TRUSTED_RESEARCH_CLI = $trustedResearchCli }
            Invoke-Checked "node" $supervisorArgs $runDir
        } finally {
            $env:BORDERCLASH_TRUSTED_RESEARCH_CLI = $previousTrustedResearchCli
        }

        if (-not (Test-Path -LiteralPath $sessionPath)) { throw "AGY supervisor did not write session state" }
        $agySession = Get-Content -LiteralPath $sessionPath -Raw | ConvertFrom-Json
        if ($agySession.conversationId) { $conversationId = [string]$agySession.conversationId }
        if ($agySession.PSObject.Properties["attempts"] -and [int]$agySession.attempts -gt 1) {
            $resumeCount += ([int]$agySession.attempts - 1)
        }

        if ((Test-Path -LiteralPath $resultPath) -and (Get-Item -LiteralPath $resultPath).Length -gt 0) {
            $result = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
        }

        if ([string]$agySession.status -eq "recoverable" -and $conversationId) {
            $recoveryReason = if ($agySession.recoveryReason) { [string]$agySession.recoveryReason } else { "retryable:provider" }
            Save-DataPatch $runDir $baseHead (Join-Path $logDir "$runId.data.patch")
            Write-RecoveryRecord $runId "resumable" $recoveryReason $runDir $baseHead $conversationId
            Write-RuntimeState "resumable" $runId "Cycle checkpointed after repeated recoverable AGY interruption" $runDir $baseHead $conversationId $resumeCount $recoveryReason $agyModel @{
                workspaceUsable = $true
                conversationResumable = $true
            }
            Write-Output "DEFERRED: $recoveryReason conversation=$conversationId run=$runId"
            exit 0
        }

        if ([string]$agySession.status -ne "success") {
            $agyExit = if ($agySession.PSObject.Properties["exitCode"]) { [int]$agySession.exitCode } else { -1 }
            throw "Antigravity failed with status $($agySession.status) exit=$agyExit. See $resultPath and $stderrPath"
        }
    }

    if (-not $result) { throw "Antigravity did not return a terminal result event" }
    if ($result.status -ne "SUCCESS") { throw "Antigravity status was $($result.status)" }

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

    $finishMarkerPath = Join-Path $runDir ".work\research-finish.json"
    if (-not (Test-Path -LiteralPath $finishMarkerPath)) {
        throw "Antigravity did not run pnpm research finish"
    }
    $finishMarker = Get-Content -LiteralPath $finishMarkerPath -Raw | ConvertFrom-Json
    if ([string]$finishMarker.cycleId -ne $runId) {
        throw "Research finish marker belongs to another cycle"
    }
    if ([string]$finishMarker.decision -eq "review") {
        $reviewReason = [string]$finishMarker.reason
        if ([string]::IsNullOrWhiteSpace($reviewReason)) { $reviewReason = "Agent requested operator review" }
        Save-DataPatch $runDir $baseHead (Join-Path $logDir "$runId.data.patch")
        Write-RecoveryRecord $runId "review" $reviewReason $runDir $baseHead $conversationId
        Write-RuntimeState "review" $runId $reviewReason $runDir $baseHead $conversationId $resumeCount "agent_review"
        Write-Output "REVIEW HOLD: $reviewReason"
        exit 0
    }
    if ([string]$finishMarker.decision -ne "complete") {
        throw "Research finish marker has invalid decision"
    }

    if (-not $isFakeAgent) {
        Invoke-EvidenceCapture $runDir $baseHead $runId
    }

    $runStatePath = Join-Path $runDir "data\research-state.json"
    $completion = Get-OrCreateRunnerCompletion $runDir $runId $baseHead $state $finishMarker
    $runState = New-CompletedResearchState $state $completion
    Write-JsonAtomicFile $runStatePath $runState
    $runState = Read-State $runStatePath
    Assert-CycleStateAdvanced $state $runState
    Assert-ResearchOnlyPaths $runDir $baseHead

    $cycleHead = (git -C $runDir rev-parse HEAD).Trim()
    & git -C $runDir merge-base --is-ancestor $baseHead $cycleHead
    if ($LASTEXITCODE -ne 0) {
        throw "Agent rewrote branch history outside the cycle base."
    }

    Invoke-Checked "node" @((Join-Path $repoRoot "research\validate.mjs")) $runDir
    Invoke-Checked "node" @((Join-Path $repoRoot "scripts\generate-public.mjs")) $runDir
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
        Write-RuntimeState "validated" $runId "Shadow cycle passed; publication disabled" $runDir $baseHead $conversationId $resumeCount
        Write-Output "SHADOW SUCCESS: conversation=$($result.conversation_id)"
        Write-Output "commit=$cycleCommit"
        exit 0
    }

    $publishArgs = @(
        "--repo-root", $repoRoot,
        "--run-dir", $runDir,
        "--base-head", $baseHead,
        "--cycle-commit", $cycleCommit,
        "--remote-name", $RemoteName,
        "--candidate-root", $runsRoot,
        "--pending-path", $pendingPublicationPath,
        "--run-id", $runId,
        "--cycle-started-at", [string][int64]$cycleStartedAt,
        "--expected-last-research-at", [string][int64]$runState.lastResearchAt,
        "--expected-next-run-at", [string][int64]$runState.nextRunAt
    )
    $publication = Invoke-PublicationTool "publish" $publishArgs
    if ([string]$publication.status -eq "awaiting-public") {
        $publication = Invoke-PublicationTool "resume" (Get-PublicationResumeArgs)
    }
    Write-Output (Set-PublicationRuntime $publication $conversationId $resumeCount)
    exit 0
}
catch {
    $message = $_.Exception.Message
    $runtimeRunDir = $runDir
    if ($runDir -and (Test-Path -LiteralPath $runDir)) {
        try { Save-DataPatch $runDir $baseHead (Join-Path $logDir "$runId.data.patch") } catch { Write-Warning $_.Exception.Message }
        Write-RecoveryRecord $runId "review" $message $runDir $baseHead $conversationId
        $conversationCanResume = [bool]$conversationId
        if ($agySession -and $agySession.PSObject.Properties["status"] -and [string]$agySession.status -eq "error") {
            $conversationCanResume = $false
        }
        Write-RuntimeState "review" $runId $message $runtimeRunDir $baseHead $conversationId $resumeCount "operator_review" $agyModel @{
            workspaceUsable = $true
            conversationResumable = $conversationCanResume
        }
    } else {
        Write-RuntimeState "failed" $runId $message "" $baseHead $conversationId $resumeCount
    }
    Write-Error $message
    exit 1
}
finally {
    if ($lock) {
        try { $lock.ReleaseMutex() } catch { }
        $lock.Dispose()
    }
}
