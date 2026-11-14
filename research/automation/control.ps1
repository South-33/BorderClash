param(
    [ValidateSet("status", "pause", "stop", "resume", "run-now", "restart-fresh", "cleanup")]
    [string]$Command = "status",
    [switch]$Apply,
    [string]$AgyPath = "",
    [string]$RemoteName = "origin",
    [string]$RunsRoot = "",
    [string]$RuntimeDir = "",
    [string]$LogDir = "",
    [string]$MutexName = "Global\BorderClashResearchCycle"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$runnerRoot = Join-Path $repoRoot ".work\runner"
$runsRoot = if ($RunsRoot) { [IO.Path]::GetFullPath($RunsRoot) } else { Join-Path $runnerRoot "runs" }
$runtimeDir = if ($RuntimeDir) { [IO.Path]::GetFullPath($RuntimeDir) } else { Join-Path $runnerRoot "runtime" }
$logDir = if ($LogDir) { [IO.Path]::GetFullPath($LogDir) } else { Join-Path $runnerRoot "logs" }
$controlPath = Join-Path $runtimeDir "control.json"
$runtimePath = Join-Path $runtimeDir "runtime.json"
$pendingPublicationPath = Join-Path $runtimeDir "pending-publication.json"
$retiredDir = Join-Path (Split-Path -Parent $runsRoot) "retired"
$runner = Join-Path $repoRoot "research\automation\run-cycle.ps1"
. (Join-Path $PSScriptRoot "schedule-policy.ps1")

New-Item -ItemType Directory -Force -Path $runsRoot, $runtimeDir, $logDir, $retiredDir | Out-Null

function Write-JsonAtomic {
    param([string]$Path, $Value)

    $parent = Split-Path -Parent $Path
    if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    $temp = "$Path.$PID.$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()).tmp"
    [IO.File]::WriteAllText(
        $temp,
        ($Value | ConvertTo-Json -Depth 30) + [Environment]::NewLine,
        [Text.UTF8Encoding]::new($false)
    )
    Move-Item -LiteralPath $temp -Destination $Path -Force
}

function Read-JsonSafe {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try { return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json } catch { return $null }
}

function Read-Control {
    $value = Read-JsonSafe $controlPath
    if ($null -eq $value) {
        return [pscustomobject]@{
            paused = $false
            stopped = $false
            updatedAt = 0
        }
    }
    return $value
}

function Save-Control {
    param([bool]$Paused, [bool]$Stopped)
    $value = [ordered]@{
        paused = $Paused
        stopped = $Stopped
        updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    }
    Write-JsonAtomic $controlPath $value
    return $value
}

function Get-OwnedRunDirectory {
    param([string]$Candidate)
    if (-not $Candidate) { return "" }
    try {
        $candidatePath = [IO.Path]::GetFullPath($Candidate).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
        $ownedRoot = [IO.Path]::GetFullPath($runsRoot).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    } catch { return "" }
    $prefix = $ownedRoot + [IO.Path]::DirectorySeparatorChar
    if (-not $candidatePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { return "" }
    return $candidatePath
}

function Test-ProcessInstance {
    param([int]$ProcessId, [int64]$StartedAt)
    if ($ProcessId -le 0 -or $StartedAt -le 0) { return $false }
    try {
        $process = Get-Process -Id $ProcessId -ErrorAction Stop
        [DateTimeOffset]$start = $process.StartTime
        return [Math]::Abs($start.ToUnixTimeMilliseconds() - $StartedAt) -lt 15000
    } catch {
        return $false
    }
}

function Stop-OwnedRunner {
    param($Runtime)
    if ($null -eq $Runtime) { return $false }
    if (-not $Runtime.PSObject.Properties["runnerPid"] -or -not $Runtime.PSObject.Properties["runnerStartedAt"]) {
        return $false
    }
    $pidValue = [int]$Runtime.runnerPid
    $startedAt = [int64]$Runtime.runnerStartedAt
    if (-not (Test-ProcessInstance $pidValue $startedAt)) { return $false }
    & taskkill.exe /PID $pidValue /T /F | Out-Null
    return $true
}

function Get-SessionState {
    param([string]$RunDir)
    $owned = Get-OwnedRunDirectory $RunDir
    if (-not $owned) { return $null }
    return Read-JsonSafe (Join-Path $owned ".work\AGY_SESSION.json")
}

function Set-RuntimeAfterStop {
    param($Runtime)
    if ($null -eq $Runtime) { return }
    $runDir = if ($Runtime.PSObject.Properties["runDir"]) { Get-OwnedRunDirectory ([string]$Runtime.runDir) } else { "" }
    if (-not $runDir) { return }
    $session = Get-SessionState $runDir
    $conversationId = if ($session -and $session.PSObject.Properties["conversationId"]) {
        [string]$session.conversationId
    } elseif ($Runtime.PSObject.Properties["conversationId"]) {
        [string]$Runtime.conversationId
    } else { "" }
    $status = if ($conversationId) { "resumable" } else { "review" }
    $message = if ($conversationId) {
        "Operator stopped the owned process tree; saved conversation and workspace are resumable."
    } else {
        "Operator stopped the owned process tree before a conversation checkpoint; workspace requires review."
    }
    $next = [ordered]@{
        updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        status = $status
        phase = $status
        runId = [string]$Runtime.runId
        model = if ($Runtime.PSObject.Properties["model"]) { [string]$Runtime.model } else { "gemini-3.8-flash-medium" }
        message = $message
        runDir = $runDir
        recoveryReason = "operator_stop"
        workspaceUsable = $true
        conversationResumable = [bool]$conversationId
    }
    foreach ($name in @("baseHead", "conversationId", "resumeCount")) {
        if ($Runtime.PSObject.Properties[$name] -and $Runtime.$name) { $next[$name] = $Runtime.$name }
    }
    if ($conversationId) { $next["conversationId"] = $conversationId }
    Write-JsonAtomic $runtimePath $next
}

function Get-NextAction {
    param($Control, $Runtime)
    if ($Control.stopped) { return "Use resume to continue saved work, or restart-fresh to retire it and start over." }
    if ($Control.paused) { return "Use resume to restore scheduling, or run-now for an explicit manual cycle." }
    if ($null -eq $Runtime) { return "No local cycle is active. Wait for the scheduler or use run-now." }
    switch ([string]$Runtime.status) {
        "running" { return "A cycle is active. Use stop only if it must be interrupted." }
        "resumable" { return "Use resume to continue the saved conversation in its original workspace." }
        "ready" { return "Use resume to validate the completed agent turn without another model call." }
        "review" { return "Resolve the reported issue, then use resume when safe or restart-fresh to retire this checkpoint." }
        "validated" { return "Review the nonpublishing result. Use cleanup when the workspace is no longer needed." }
        "pending-publication" { return "Publication is pending. Do not start another research cycle." }
        "published" { return "The cycle is published. Cleanup is optional after diagnostics are no longer needed." }
        default { return "Wait for the next due cycle or use run-now." }
    }
}

function Show-Status {
    $control = Read-Control
    $runtime = Read-JsonSafe $runtimePath
    $state = Read-JsonSafe (Join-Path $repoRoot "data\research-state.json")
    $leadMinutes = Get-ResearchLeadMinutes -LogDir $logDir
    $cadenceWarning = if ($state) {
        Get-ResearchCadenceWarning -IntervalHours ([double]$state.lastCycleInterval) -LeadMinutes $leadMinutes
    } else { "" }
    [ordered]@{
        paused = [bool]$control.paused
        stopped = [bool]$control.stopped
        runtime = $runtime
        schedule = if ($state) {
            [ordered]@{
                lastResearchAt = $state.lastResearchAt
                nextRunAt = $state.nextRunAt
                intervalHours = $state.lastCycleInterval
                leadMinutes = $leadMinutes
                cadenceWarning = $cadenceWarning
            }
        } else { $null }
        nextAction = Get-NextAction $control $runtime
    } | ConvertTo-Json -Depth 30
}

function Invoke-Runner {
    param([switch]$Force)
    $args = @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $runner,
        "-RemoteName", $RemoteName,
        "-RunsRoot", $runsRoot,
        "-RuntimeDir", $runtimeDir,
        "-LogDir", $logDir,
        "-MutexName", $MutexName
    )
    if ($Force) { $args += "-Force" }
    if ($AgyPath) { $args += @("-AgyPath", $AgyPath) }
    if (-not $AgyPath) { $args += "-Publish" }
    & powershell.exe @args
    $script:runnerExitCode = $LASTEXITCODE
}

function Retire-Checkpoint {
    param($Runtime)
    if ($null -eq $Runtime -or -not $Runtime.runId) { return }
    $record = [ordered]@{
        runId = [string]$Runtime.runId
        retiredAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        previousStatus = [string]$Runtime.status
        reason = "operator_restart_fresh"
        runDir = if ($Runtime.PSObject.Properties["runDir"]) { Get-OwnedRunDirectory ([string]$Runtime.runDir) } else { "" }
        baseHead = if ($Runtime.PSObject.Properties["baseHead"]) { [string]$Runtime.baseHead } else { "" }
        conversationId = if ($Runtime.PSObject.Properties["conversationId"]) { [string]$Runtime.conversationId } else { "" }
    }
    Write-JsonAtomic (Join-Path $retiredDir "$($record.runId).json") $record
    $next = [ordered]@{
        updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        status = "retired"
        phase = "retired"
        runId = $record.runId
        model = if ($Runtime.PSObject.Properties["model"]) { [string]$Runtime.model } else { "gemini-3.8-flash-medium" }
        message = "Checkpoint retired by operator; workspace kept for inspection."
        runDir = $record.runDir
    }
    Write-JsonAtomic $runtimePath $next
}

function Get-CleanupCandidates {
    $active = Read-JsonSafe $runtimePath
    $protected = ""
    if ($active -and [string]$active.status -in @("running", "resumable", "ready", "review", "pending-publication")) {
        $protected = if ($active.PSObject.Properties["runDir"]) { Get-OwnedRunDirectory ([string]$active.runDir) } else { "" }
    }
    $candidates = @()
    foreach ($recordFile in Get-ChildItem -LiteralPath $retiredDir -Filter "*.json" -File -ErrorAction SilentlyContinue) {
        $record = Read-JsonSafe $recordFile.FullName
        if (-not $record -or -not $record.runDir) { continue }
        $owned = Get-OwnedRunDirectory ([string]$record.runDir)
        if ($owned -and $owned -ne $protected -and (Test-Path -LiteralPath $owned)) {
            $candidates += [pscustomobject]@{ runId = [string]$record.runId; runDir = $owned; source = "retired"; record = $recordFile.FullName }
        }
    }
    if ($active -and [string]$active.status -eq "validated" -and $active.PSObject.Properties["runDir"]) {
        $owned = Get-OwnedRunDirectory ([string]$active.runDir)
        if ($owned -and (Test-Path -LiteralPath $owned)) {
            $candidates += [pscustomobject]@{ runId = [string]$active.runId; runDir = $owned; source = "validated"; record = "" }
        }
    }
    if ($active -and [string]$active.status -eq "published") {
        foreach ($entry in @(
            @{ property = "runDir"; source = "published-source" },
            @{ property = "publishCandidate"; source = "published-candidate" }
        )) {
            $property = [string]$entry.property
            if (-not $active.PSObject.Properties[$property] -or -not $active.$property) { continue }
            $owned = Get-OwnedRunDirectory ([string]$active.$property)
            if ($owned -and (Test-Path -LiteralPath $owned)) {
                $candidates += [pscustomobject]@{ runId = [string]$active.runId; runDir = $owned; source = [string]$entry.source; record = "" }
            }
        }
    }
    return @($candidates | Sort-Object runDir -Unique)
}

switch ($Command) {
    "status" {
        Show-Status
        exit 0
    }
    "pause" {
        $control = Read-Control
        Save-Control -Paused $true -Stopped ([bool]$control.stopped) | Out-Null
        Show-Status
        exit 0
    }
    "stop" {
        $control = Read-Control
        Save-Control -Paused ([bool]$control.paused) -Stopped $true | Out-Null
        $runtime = Read-JsonSafe $runtimePath
        $stoppedProcess = Stop-OwnedRunner $runtime
        Set-RuntimeAfterStop $runtime
        Write-Output ("ownedProcessStopped=" + $stoppedProcess.ToString().ToLowerInvariant())
        Show-Status
        exit 0
    }
    "resume" {
        Save-Control -Paused $false -Stopped $false | Out-Null
        $runtime = Read-JsonSafe $runtimePath
        if (
            $runtime -and
            [string]$runtime.status -eq "review" -and
            [string]$runtime.recoveryReason -eq "publication_review" -and
            (Test-Path -LiteralPath $pendingPublicationPath)
        ) {
            $pending = Read-JsonSafe $pendingPublicationPath
            if (-not $pending -or [string]$pending.runId -ne [string]$runtime.runId) {
                throw "Publication review hold has no matching pending publication record."
            }
            $pending.status = "prepared"
            if ($pending.PSObject.Properties["reason"]) { $pending.PSObject.Properties.Remove("reason") }
            Write-JsonAtomic $pendingPublicationPath $pending
            Invoke-Runner -Force
            exit $script:runnerExitCode
        }
        if ($runtime -and [string]$runtime.status -eq "review") {
            $session = Get-SessionState ([string]$runtime.runDir)
            if (
                [string]$runtime.recoveryReason -ne "agent_review" -and
                $session -and
                [string]$session.status -eq "success"
            ) {
                $runtime.status = "ready"
                $runtime.phase = "ready"
                $runtime.message = "Operator cleared review hold; validating saved completed turn."
                Write-JsonAtomic $runtimePath $runtime
            } elseif ($session -and $session.conversationId) {
                $runtime.status = "resumable"
                $runtime.phase = "resumable"
                $runtime.message = "Operator cleared review hold; resuming saved conversation."
                Write-JsonAtomic $runtimePath $runtime
            } else {
                throw "Review hold has no resumable conversation or completed turn. Use restart-fresh after inspecting the workspace."
            }
        }
        $runtime = Read-JsonSafe $runtimePath
        if ($runtime -and [string]$runtime.status -in @("resumable", "ready", "pending-publication")) {
            Invoke-Runner -Force
            exit $script:runnerExitCode
        }
        Show-Status
        exit 0
    }
    "run-now" {
        $control = Read-Control
        Save-Control -Paused ([bool]$control.paused) -Stopped $false | Out-Null
        Invoke-Runner -Force
        exit $script:runnerExitCode
    }
    "restart-fresh" {
        $runtime = Read-JsonSafe $runtimePath
        if ($runtime -and [string]$runtime.status -eq "running") {
            throw "A cycle is still running. Stop it before restart-fresh."
        }
        if (Test-Path -LiteralPath $pendingPublicationPath) {
            $pending = Read-JsonSafe $pendingPublicationPath
            if ($pending) {
                $pending | Add-Member -NotePropertyName retiredAt -NotePropertyValue ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) -Force
                $pending | Add-Member -NotePropertyName retiredReason -NotePropertyValue "operator_restart_fresh" -Force
                $pendingRunId = if ($pending.runId) { [string]$pending.runId } else { "unknown" }
                Write-JsonAtomic (Join-Path $retiredDir "$pendingRunId.publication.json") $pending
            }
            Remove-Item -LiteralPath $pendingPublicationPath -Force
        }
        Retire-Checkpoint $runtime
        Save-Control -Paused $false -Stopped $false | Out-Null
        Invoke-Runner -Force
        exit $script:runnerExitCode
    }
    "cleanup" {
        $candidates = @(Get-CleanupCandidates)
        if (-not $Apply) {
            [ordered]@{
                apply = $false
                candidates = @($candidates | Select-Object runId, runDir, source)
            } | ConvertTo-Json -Depth 10
            exit 0
        }
        $removed = @()
        foreach ($candidate in $candidates) {
            $owned = Get-OwnedRunDirectory ([string]$candidate.runDir)
            if (-not $owned -or -not (Test-Path -LiteralPath $owned)) { continue }
            Remove-Item -LiteralPath $owned -Recurse -Force
            if (Test-Path -LiteralPath $owned) { throw "Could not remove $owned" }
            $removed += [string]$candidate.runId
            if ($candidate.record) {
                $record = Read-JsonSafe ([string]$candidate.record)
                if ($record) {
                    $record | Add-Member -NotePropertyName cleanedAt -NotePropertyValue ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) -Force
                    $record.runDir = ""
                    Write-JsonAtomic ([string]$candidate.record) $record
                }
            }
        }
        $runtime = Read-JsonSafe $runtimePath
        if ($runtime -and [string]$runtime.runId -in $removed) {
            if ($runtime.PSObject.Properties["runDir"]) { $runtime.runDir = "" }
            if ($runtime.PSObject.Properties["publishCandidate"] -and [string]$runtime.publishCandidate -and -not (Test-Path -LiteralPath ([string]$runtime.publishCandidate))) {
                $runtime.publishCandidate = ""
            }
            $runtime.message = if ([string]$runtime.status -eq "published") {
                "Published workspaces cleaned by operator; delivery diagnostics retained."
            } else {
                "Validated shadow workspace cleaned by operator."
            }
            Write-JsonAtomic $runtimePath $runtime
        }
        [ordered]@{ apply = $true; removed = $removed } | ConvertTo-Json -Depth 10
        exit 0
    }
}
