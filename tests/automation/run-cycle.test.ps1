param(
    [ValidateSet("all", "controls", "recovery", "stop", "publication-code", "publication-overlap")]
    [string]$Section = "all"
)

$testShell = (Get-Process -Id $PID).Path
$windowOptions = @{}
if ($env:OS -eq "Windows_NT") { $windowOptions.WindowStyle = "Hidden" }

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$runner = Join-Path $repoRoot "research\automation\run-cycle.ps1"
$control = Join-Path $repoRoot "research\automation\control.ps1"
$supervisor = Join-Path $repoRoot "research\automation\agy-supervisor.mjs"
$trustedResearchCli = Join-Path $repoRoot "research\cli.mjs"
$fakeExe = Join-Path $PSScriptRoot "fake-agy.ps1"
$fakePublic = Join-Path $PSScriptRoot "fake-public.mjs"
$fixtureMutator = Join-Path $PSScriptRoot "mutate-fixture.mjs"
$testRoot = Join-Path $repoRoot ".work\tests\run-cycle-$PID"
$runsRoot = Join-Path $testRoot "runs"
$runtimeDir = Join-Path $testRoot "runtime"
$logDir = Join-Path $testRoot "logs"
$mutexName = "Global\BorderClashResearchCycleTest-$PID"
$realGit = (Get-Command git).Source
$testRemotes = [Collections.Generic.List[string]]::new()
$serverProcesses = [Collections.Generic.List[Diagnostics.Process]]::new()

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERTION FAILED: $Message" }
}

function Test-Section {
    param([string]$Name)
    return $Section -eq "all" -or $Section -eq $Name
}

function Read-JsonSafe {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try { return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json } catch { return $null }
}

function Get-Runtime {
    return Read-JsonSafe (Join-Path $runtimeDir "runtime.json")
}

function Reset-TestArtifacts {
    foreach ($process in @($serverProcesses)) {
        if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
    }
    $serverProcesses.Clear()
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $runsRoot, $runtimeDir, $logDir | Out-Null
}

function Invoke-TestRunner {
    param(
        [switch]$Publish,
        [string]$RemoteName = "origin",
        [string]$PublicBaseUrl = "http://127.0.0.1:9"
    )
    $arguments = @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $runner,
        "-Force", "-AgyPath", $fakeExe, "-TimeoutMinutes", "1",
        "-RunsRoot", $runsRoot, "-RuntimeDir", $runtimeDir, "-LogDir", $logDir,
        "-MutexName", $mutexName, "-RemoteName", $RemoteName,
        "-PublicBaseUrl", $PublicBaseUrl, "-DeliveryTimeoutSeconds", "12", "-DeliveryPollMilliseconds", "100"
    )
    if ($Publish) { $arguments += "-Publish" }
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & $testShell @arguments 2>&1
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $old
    }
    return @{ ExitCode = $exitCode; Output = @($output) }
}

function Start-TestRunner {
    $arguments = @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $runner,
        "-Force", "-AgyPath", $fakeExe, "-TimeoutMinutes", "1",
        "-RunsRoot", $runsRoot, "-RuntimeDir", $runtimeDir, "-LogDir", $logDir,
        "-MutexName", $mutexName, "-RemoteName", "origin"
    )
    return Start-Process $testShell -ArgumentList $arguments -PassThru @windowOptions
}

function Invoke-Control {
    param([string]$Command, [switch]$Apply)
    $arguments = @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $control,
        "-Command", $Command, "-AgyPath", $fakeExe,
        "-RunsRoot", $runsRoot, "-RuntimeDir", $runtimeDir, "-LogDir", $logDir,
        "-MutexName", $mutexName, "-RemoteName", "origin"
    )
    if ($Apply) { $arguments += "-Apply" }
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & $testShell @arguments 2>&1
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $old
    }
    return @{ ExitCode = $exitCode; Output = @($output) }
}

function Wait-Until {
    param([scriptblock]$Condition, [int]$TimeoutSeconds = 10)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        if (& $Condition) { return $true }
        Start-Sleep -Milliseconds 100
    } while ((Get-Date) -lt $deadline)
    return $false
}

function New-RecoveryFixture {
    param(
        [string]$RunId,
        [string]$RuntimeStatus = "running",
        [string]$SessionStatus = "running",
        [string]$ConversationId = "fixture-conversation",
        [string]$Model = "gemini-3.8-flash-medium",
        [switch]$Completed,
        [switch]$TerminalError
    )
    $head = (git -C $repoRoot rev-parse HEAD).Trim()
    $runDir = Join-Path $runsRoot $RunId
    & $realGit clone --quiet --no-checkout --no-hardlinks $repoRoot $runDir
    Assert-True ($LASTEXITCODE -eq 0) "fixture clone failed"
    & $realGit -C $runDir config core.autocrlf false
    Assert-True ($LASTEXITCODE -eq 0) "fixture could not disable autocrlf"
    & $realGit -C $runDir config core.safecrlf false
    Assert-True ($LASTEXITCODE -eq 0) "fixture could not disable safecrlf"
    & $realGit -C $runDir checkout --quiet --detach $head
    Assert-True ($LASTEXITCODE -eq 0) "fixture checkout failed"
    New-Item -ItemType Directory -Force -Path (Join-Path $runDir ".work") | Out-Null
    Push-Location $runDir
    try {
        $context = & node $trustedResearchCli context
        Assert-True ($LASTEXITCODE -eq 0) "fixture context failed"
    } finally { Pop-Location }
    [IO.File]::WriteAllText(
        (Join-Path $runDir ".work\CYCLE_CONTEXT.md"),
        [string]::Join([Environment]::NewLine, [string[]]$context) + [Environment]::NewLine,
        [Text.UTF8Encoding]::new($false)
    )
    if ($Completed) {
        [IO.File]::WriteAllText(
            (Join-Path $runDir ".work\CYCLE_RUN.json"),
            (([ordered]@{ runId = $RunId; baseHead = $head; model = $Model } | ConvertTo-Json) + [Environment]::NewLine),
            [Text.UTF8Encoding]::new($false)
        )
        Push-Location $runDir
        try { & node $trustedResearchCli finish 12 "Completed fixture." | Out-Null } finally { Pop-Location }
        Assert-True ($LASTEXITCODE -eq 0) "fixture finish failed"
    }
    $session = [ordered]@{
        status = $SessionStatus
        conversationId = $ConversationId
        model = $Model
        cwd = $runDir
        attempts = 1
        updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    }
    if ($Completed) {
        $session.result = [ordered]@{
            conversation_id = $ConversationId
            status = "SUCCESS"
            response = "fake complete`nHARNESS_FEEDBACK: none`n<!-- GOAL_COMPLETE -->"
        }
    } elseif ($TerminalError) {
        $session.exitCode = 23
        $session.result = [ordered]@{ conversation_id = $ConversationId; status = "ERROR"; error = "terminal fixture" }
        $session.agyError = [ordered]@{ status = "INVALID_ARGUMENT"; retryable = $false }
    }
    [IO.File]::WriteAllText(
        (Join-Path $runDir ".work\AGY_SESSION.json"),
        (($session | ConvertTo-Json -Depth 20) + [Environment]::NewLine),
        [Text.UTF8Encoding]::new($false)
    )
    $runtime = [ordered]@{
        updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        status = $RuntimeStatus
        phase = $RuntimeStatus
        runId = $RunId
        model = $Model
        message = "fixture"
        runDir = $runDir
        baseHead = $head
        conversationId = $ConversationId
    }
    [IO.File]::WriteAllText(
        (Join-Path $runtimeDir "runtime.json"),
        (($runtime | ConvertTo-Json -Depth 20) + [Environment]::NewLine),
        [Text.UTF8Encoding]::new($false)
    )
    return $runDir
}

function New-TestRemote {
    param([string]$Name)
    $path = Join-Path $testRoot "$Name.git"
    & $realGit init --bare $path | Out-Null
    Assert-True ($LASTEXITCODE -eq 0) "bare remote init failed"
    & $realGit -C $repoRoot remote add $Name $path
    Assert-True ($LASTEXITCODE -eq 0) "test remote add failed"
    $testRemotes.Add($Name)
    $head = (& $realGit -C $repoRoot rev-parse HEAD).Trim()
    $oldErrorAction = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        & $realGit -C $repoRoot push $Name "${head}:refs/heads/main" 2>&1 | Out-Null
        $pushExit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $oldErrorAction
    }
    Assert-True ($pushExit -eq 0) "test remote seed failed"
    return $path
}

function Push-ExternalCommit {
    param([string]$RemotePath, [ValidateSet("code", "data")][string]$Kind, [string]$Ref = "main")
    $dir = Join-Path $testRoot ("external-" + [Guid]::NewGuid().ToString("N"))
    & $realGit clone --quiet --branch main $RemotePath $dir
    Assert-True ($LASTEXITCODE -eq 0) "external clone failed"
    if ($Kind -eq "code") {
        Add-Content -LiteralPath (Join-Path $dir "README.md") -Value "`nexternal code-only fixture"
    } else {
        $path = Join-Path $dir "data\current\summary.json"
        & node $fixtureMutator append-summary $path " External data fixture."
        Assert-True ($LASTEXITCODE -eq 0) "external data fixture mutation failed"
    }
    & $realGit -C $dir add -A
    & $realGit -C $dir -c user.name=Fixture -c user.email=fixture@example.invalid commit --quiet -m "fixture $Kind advance"
    Assert-True ($LASTEXITCODE -eq 0) "external commit failed"
    $commit = (& $realGit -C $dir rev-parse HEAD).Trim()
    $targetRef = if ($Ref -eq "main") { "refs/heads/main" } else { "refs/$Ref" }
    $oldErrorAction = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        & $realGit -C $dir push origin "HEAD:$targetRef" 2>&1 | Out-Null
        $pushExit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $oldErrorAction
    }
    Assert-True ($pushExit -eq 0) "external push failed"
    return $commit
}

function Start-FakePublic {
    param([string]$RemotePath)
    $portFile = Join-Path $testRoot ("port-" + [Guid]::NewGuid().ToString("N") + ".txt")
    $workDir = Join-Path $testRoot ("public-" + [Guid]::NewGuid().ToString("N"))
    $process = Start-Process node -ArgumentList @($fakePublic, "--remote", $RemotePath, "--port-file", $portFile, "--work-dir", $workDir) -PassThru @windowOptions
    $serverProcesses.Add($process)
    Assert-True (Wait-Until { Test-Path -LiteralPath $portFile } 10) "fake public server did not start"
    $port = (Get-Content -LiteralPath $portFile -Raw).Trim()
    return "http://127.0.0.1:$port"
}

function Remove-TestRemotes {
    foreach ($name in @($testRemotes)) {
        if (@(& $realGit -C $repoRoot remote) -contains $name) { & $realGit -C $repoRoot remote remove $name | Out-Null }
    }
    $testRemotes.Clear()
}

$headBefore = (& $realGit -C $repoRoot rev-parse HEAD).Trim()
$statusBefore = (@(& $realGit -C $repoRoot status --porcelain) -join "`n")
Reset-TestArtifacts

try {
    if (Test-Section "controls") {
    Write-Output "automation: entry-point and shadow controls"
    # Real entry points are pinned to South; fake injection remains portable.
    if ([Environment]::MachineName -ine "SouthServer") {
    $oldErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $realAttempt = & $testShell -NoProfile -ExecutionPolicy Bypass -File $runner -Force 2>&1
        $realAttemptExit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $oldErrorAction
    }
    Assert-True ($realAttemptExit -ne 0) "real runner unexpectedly started off South"
    Assert-True (($realAttempt -join "`n") -match "only on SouthServer") "real runner did not name the South boundary"

    }

    $env:BORDERCLASH_EXPECT_MODEL = "gemini-3.8-flash-medium"
    $env:BORDERCLASH_FAKE_AGY_MODE = "success"
    $success = Invoke-TestRunner
    Assert-True ($success.ExitCode -eq 0) "fake medium cycle failed: $($success.Output -join ' | ')"
    Assert-True (($success.Output -join "`n") -match "SHADOW SUCCESS") "shadow cycle did not validate"
    $validated = Get-Runtime
    Assert-True ($validated.status -eq "validated") "shadow cycle did not reach validated state"
    Assert-True (Test-Path -LiteralPath ([string]$validated.runDir)) "validated workspace was not retained"
    $historyPath = Join-Path $testRoot "history\$($validated.runId)\report.json"
    $cycleHistory = Read-JsonSafe $historyPath
    Assert-True ($cycleHistory -and [string]$cycleHistory.status -eq "validated") "runner did not save the completed cycle review"
    Assert-True ($null -ne $cycleHistory.PSObject.Properties["steps"]) "saved cycle review is missing its tool-trace field"
    Remove-Item Env:BORDERCLASH_EXPECT_MODEL -ErrorAction SilentlyContinue

    # Structured finish state is authoritative. Final-response formatting is
    # useful observability but must not veto an otherwise valid cycle.
    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "missing-feedback"
    $plainResponse = Invoke-TestRunner
    Assert-True ($plainResponse.ExitCode -eq 0 -and ($plainResponse.Output -join "`n") -match "SHADOW SUCCESS") "plain final response incorrectly blocked structured completion"
    $validated = Get-Runtime
    Assert-True ($validated.status -eq "validated") "plain final response did not leave a validated workspace"

    # Cleanup is preview-first and only removes eligible owned workspaces.
    $preview = Invoke-Control "cleanup"
    Assert-True ($preview.ExitCode -eq 0) "cleanup preview failed"
    $previewJson = ($preview.Output -join "`n") | ConvertFrom-Json
    Assert-True (@($previewJson.candidates | Where-Object { [string]$_.runDir -eq [string]$validated.runDir }).Count -eq 1) "cleanup preview omitted validated workspace"
    $cleaned = Invoke-Control "cleanup" -Apply
    Assert-True ($cleaned.ExitCode -eq 0) "cleanup apply failed"
    Assert-True (-not (Test-Path -LiteralPath ([string]$validated.runDir))) "cleanup left validated workspace"
    Assert-True (Test-Path -LiteralPath (Join-Path $testRoot "history\$($validated.runId)\report.md")) "cleanup removed the saved cycle review"

    # Windows readers can briefly lock AGY_SESSION.json. Atomic session-state
    # writes must retry the rename instead of crashing the supervisor.
    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "session-lock"
    $lockedSession = Invoke-TestRunner
    Assert-True ($lockedSession.ExitCode -eq 0 -and ($lockedSession.Output -join "`n") -match "SHADOW SUCCESS") "brief session-file lock crashed the streaming supervisor"

    # Publication credentials stay in the trusted runner environment and are
    # removed from the AGY child process, including ambient Git/GitHub auth.
    Reset-TestArtifacts
    $secretNames = @(
        "VERCEL_TOKEN",
        "GITHUB_TOKEN",
        "GH_TOKEN",
        "BORDERCLASH_VERCEL_DEPLOY_HOOK",
        "BORDERCLASH_DEPLOY_TOKEN",
        "BORDERCLASH_PUBLISH_TOKEN",
        "GIT_ASKPASS",
        "SSH_AUTH_SOCK"
    )
    $previousSecrets = @{}
    foreach ($name in $secretNames) {
        $previousSecrets[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
        [Environment]::SetEnvironmentVariable($name, "borderclash-publication-secret-sentinel", "Process")
    }
    try {
        $env:BORDERCLASH_FAKE_AGY_MODE = "trust-boundary"
        $trustBoundary = Invoke-TestRunner
        Assert-True ($trustBoundary.ExitCode -eq 0 -and ($trustBoundary.Output -join "`n") -match "SHADOW SUCCESS") "agent trust-boundary fixture failed: $($trustBoundary.Output -join ' | ')"
    } finally {
        foreach ($name in $secretNames) {
            [Environment]::SetEnvironmentVariable($name, $previousSecrets[$name], "Process")
        }
    }

    # Even if an agent hides a workspace validator replacement from ordinary
    # Git diff inspection, final validation executes the runner's trusted copy.
    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "workspace-validator-attack"
    $validatorAttack = Invoke-TestRunner
    Assert-True ($validatorAttack.ExitCode -ne 0) "workspace validator replacement bypassed trusted final validation"
    $validatorAttackRuntime = Get-Runtime
    Assert-True ($validatorAttackRuntime.status -eq "review") "workspace validator attack did not enter review"
    Assert-True ([string]$validatorAttackRuntime.message -match "node exited with code 1") "trusted validator was not the component that rejected the malicious workspace"
    Assert-True ([string]$validatorAttackRuntime.message -notmatch "UNTRUSTED VALIDATOR RAN") "agent workspace validator executed during final validation"

    Reset-TestArtifacts
    $paused = Invoke-Control "pause"
    Assert-True ($paused.ExitCode -eq 0 -and ($paused.Output -join "`n") -match '"paused":\s*true') "pause did not persist"
    $env:BORDERCLASH_FAKE_AGY_MODE = "success"
    $manual = Invoke-Control "run-now"
    Assert-True (
        $manual.ExitCode -eq 0 -and ($manual.Output -join "`n") -match "SHADOW SUCCESS"
    ) "manual run-now did not bypass the paused due path: exit=$($manual.ExitCode) output=$($manual.Output -join ' | ')"
    $manualStatus = Invoke-Control "status"
    Assert-True (($manualStatus.Output -join "`n") -match '"paused":\s*true') "run-now unexpectedly cleared the operator pause"

    # The mutex prevents duplicate starts.
    $held = [Threading.Mutex]::new($false, $mutexName)
    $owns = $false
    try {
        $owns = $held.WaitOne(0)
        Assert-True $owns "could not hold test mutex"
        $second = Invoke-TestRunner
        Assert-True ($second.ExitCode -eq 0 -and ($second.Output -join "`n") -match "SKIP: already-running") "double invocation was not suppressed"
    } finally {
        if ($owns) { $held.ReleaseMutex() }
        $held.Dispose()
    }

    # A real publish-enabled invocation must not be able to opt out of the
    # production singleton by choosing another mutex name. Fake/shadow runs may
    # still use isolated mutexes for tests and experiments.
    $oldErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $customProductionMutex = & $testShell -NoProfile -ExecutionPolicy Bypass -File $runner -Force -Publish -MutexName "Global\BorderClashOtherCycle" 2>&1
        $customProductionMutexExit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $oldErrorAction
    }
    Assert-True ($customProductionMutexExit -ne 0) "real publication unexpectedly accepted a custom cycle mutex"
    Assert-True (($customProductionMutex -join "`n") -match "canonical production mutex") "custom production mutex rejection did not explain the singleton boundary"
    }

    if (Test-Section "recovery") {
    # A repeated provider timeout checkpoints once, then resumes the same conversation/workspace.
    Write-Output "automation: provider and runner recovery"
    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "timeout-persistent"
    $deferred = Invoke-TestRunner
    Write-Output "automation: provider checkpoint returned"
    Assert-True ($deferred.ExitCode -eq 0 -and ($deferred.Output -join "`n") -match "DEFERRED: print_timeout") "provider interruption was not checkpointed"
    $checkpoint = Get-Runtime
    Assert-True ($checkpoint.status -eq "resumable") "provider checkpoint is not resumable"
    Assert-True ([bool]$checkpoint.workspaceUsable) "provider checkpoint did not record usable local files"
    Assert-True ([bool]$checkpoint.conversationResumable) "provider checkpoint did not record resumable conversation state"
    $checkpointDir = [string]$checkpoint.runDir
    $checkpointMetadata = Read-JsonSafe (Join-Path $checkpointDir ".work\CYCLE_RUN.json")
    Assert-True ($checkpointMetadata -and [int64]$checkpointMetadata.startedAt -gt 0) "provider checkpoint did not persist the original cycle start"
    $checkpointStartedAt = [int64]$checkpointMetadata.startedAt
    $resumed = Invoke-TestRunner
    Write-Output "automation: provider resume returned"
    Assert-True ($resumed.ExitCode -eq 0 -and ($resumed.Output -join "`n") -match "RESUME:.*fake-persistent-conversation") "provider checkpoint did not resume the same conversation"
    Assert-True (Test-Path -LiteralPath $checkpointDir) "resumed workspace was discarded"
    Assert-True ((Get-Runtime).status -eq "validated") "resumed cycle did not validate"
    $resumedMetadata = Read-JsonSafe (Join-Path $checkpointDir ".work\CYCLE_RUN.json")
    Assert-True ([int64]$resumedMetadata.startedAt -eq $checkpointStartedAt) "resumed cycle replaced its original start timestamp"

    # The streaming watchdog kills an inactive AGY process, then resumes the same
    # conversation without discarding untracked data created before the stall.
    Reset-TestArtifacts
    Write-Output "automation: stuck-process watchdog recovery"
    $watchdogDir = New-RecoveryFixture "watchdog-stuck"
    $watchdogHead = (& $realGit -C $watchdogDir rev-parse HEAD).Trim()
    [IO.File]::WriteAllText(
        (Join-Path $watchdogDir ".work\CYCLE_RUN.json"),
        (([ordered]@{
            runId = "watchdog-stuck"
            baseHead = $watchdogHead
            model = "gemini-3.8-flash-medium"
            startedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        } | ConvertTo-Json) + [Environment]::NewLine),
        [Text.UTF8Encoding]::new($false)
    )
    $watchdogPrompt = Join-Path $logDir "watchdog.prompt.txt"
    $watchdogContinuation = Join-Path $logDir "watchdog.continuation.txt"
    $watchdogResult = Join-Path $logDir "watchdog.result.json"
    $watchdogEvents = Join-Path $logDir "watchdog.events.ndjson"
    $watchdogStderr = Join-Path $logDir "watchdog.stderr.log"
    $watchdogSession = Join-Path $watchdogDir ".work\AGY_SESSION.json"
    [IO.File]::WriteAllText($watchdogPrompt, "watchdog fixture`n", [Text.UTF8Encoding]::new($false))
    [IO.File]::WriteAllText($watchdogContinuation, "continue watchdog fixture`n", [Text.UTF8Encoding]::new($false))
    $env:BORDERCLASH_FAKE_AGY_MODE = "stuck-resume"
    $env:BORDERCLASH_TRUSTED_RESEARCH_CLI = $trustedResearchCli
    try {
        # Give PowerShell process startup enough headroom that the resumed
        # attempt cannot be mistaken for inactivity on a loaded host. The
        # first attempt still sleeps for 30 seconds, so this 12-second
        # fixture threshold continues to exercise the watchdog kill path.
        & node $supervisor `
            --agy $fakeExe `
            --cwd $watchdogDir `
            --model "gemini-3.8-flash-medium" `
            --prompt-file $watchdogPrompt `
            --continuation-prompt-file $watchdogContinuation `
            --result-file $watchdogResult `
            --events-file $watchdogEvents `
            --stderr-file $watchdogStderr `
            --session-file $watchdogSession `
            --agy-log-base (Join-Path $logDir "watchdog.agy") `
            --timeout-minutes "0" `
            --stuck-minutes "0.2" `
            --retry-delay-ms "0"
        $watchdogExit = $LASTEXITCODE
    } finally {
        Remove-Item Env:BORDERCLASH_TRUSTED_RESEARCH_CLI -ErrorAction SilentlyContinue
    }
    Assert-True ($watchdogExit -eq 0) "stuck-process supervisor probe failed"
    $watchdogState = Read-JsonSafe $watchdogSession
    Assert-True ($watchdogState -and [string]$watchdogState.status -eq "success") "watchdog did not recover to terminal success"
    Assert-True ([int]$watchdogState.attempts -eq 2) "watchdog recovery was not bounded to one immediate retry"
    Assert-True ([string]$watchdogState.conversationId -eq "fake-stuck-conversation") "watchdog did not resume the checkpointed conversation"
    Assert-True ((Get-Content -LiteralPath $watchdogStderr -Raw) -match "stopped an inactive process") "watchdog did not record the stuck-process kill"
    Assert-True (Test-Path -LiteralPath (Join-Path $watchdogDir "data\news\2024-02.jsonl")) "watchdog recovery discarded untracked data"

    # If the trusted runner disappears while its AGY child survives, the child
    # can no longer update trusted session/result files. Kill that exact process
    # instance and resume the saved conversation instead of blocking forever.
    Reset-TestArtifacts
    Write-Output "automation: detached AGY recovery"
    $detachedDir = New-RecoveryFixture "runner-detached-agy"
    $detachedAgy = Start-Process $testShell -ArgumentList @("-NoProfile", "-Command", "Start-Sleep -Seconds 60") -PassThru @windowOptions
    $serverProcesses.Add($detachedAgy)
    [DateTimeOffset]$detachedStarted = $detachedAgy.StartTime
    $detachedSessionPath = Join-Path $detachedDir ".work\AGY_SESSION.json"
    $detachedSession = Read-JsonSafe $detachedSessionPath
    $detachedSession | Add-Member -NotePropertyName "agyPid" -NotePropertyValue ([int]$detachedAgy.Id) -Force
    $detachedSession | Add-Member -NotePropertyName "agyStartedAt" -NotePropertyValue ([int64]$detachedStarted.ToUnixTimeMilliseconds()) -Force
    [IO.File]::WriteAllText(
        $detachedSessionPath,
        (($detachedSession | ConvertTo-Json -Depth 20) + [Environment]::NewLine),
        [Text.UTF8Encoding]::new($false)
    )
    $env:BORDERCLASH_FAKE_AGY_MODE = "success"
    $detached = Invoke-TestRunner
    Assert-True ($detached.ExitCode -eq 0 -and ($detached.Output -join "`n") -match "RESUME:.*fixture-conversation") "detached AGY recovery did not resume the saved conversation"
    Assert-True (Wait-Until { $detachedAgy.HasExited } 5) "detached AGY process survived stale recovery"
    Assert-True ((Get-Runtime).status -eq "validated") "detached AGY recovery did not validate the resumed cycle"

    # Runner death after init resumes; death after terminal success validates without another model call.
    Reset-TestArtifacts
    Write-Output "automation: runner death before terminal"
    $beforeTerminalDir = New-RecoveryFixture "runner-death-before-terminal"
    $env:BORDERCLASH_FAKE_AGY_MODE = "success"
    $beforeTerminal = Invoke-TestRunner
    Write-Output "automation: runner death before terminal returned"
    Assert-True ($beforeTerminal.ExitCode -eq 0 -and ($beforeTerminal.Output -join "`n") -match "RESUME:.*fixture-conversation") "runner-death fixture did not resume: $($beforeTerminal.Output -join ' | ')"
    Assert-True (Test-Path -LiteralPath $beforeTerminalDir) "runner-death workspace was discarded"

    Reset-TestArtifacts
    Write-Output "automation: runner death after terminal"
    $afterTerminalDir = New-RecoveryFixture "runner-death-after-terminal" -SessionStatus "success" -Completed
    $env:BORDERCLASH_FAKE_AGY_MODE = "fail"
    $afterTerminal = Invoke-TestRunner
    Write-Output "automation: runner death after terminal returned"
    Assert-True ($afterTerminal.ExitCode -eq 0 -and ($afterTerminal.Output -join "`n") -match "RECOVER:.*validating without another model call") "completed turn did not use no-model recovery"
    Assert-True (($afterTerminal.Output -join "`n") -match "SHADOW SUCCESS") "completed turn did not validate"
    Assert-True (Test-Path -LiteralPath $afterTerminalDir) "completed workspace was discarded"

    # Terminal errors and pre-checkpoint changes remain inspectable, including untracked data.
    Reset-TestArtifacts
    Write-Output "automation: terminal error preservation"
    $hardDir = New-RecoveryFixture "terminal-error" -SessionStatus "error" -TerminalError
    $env:BORDERCLASH_FAKE_AGY_MODE = "success"
    $hard = Invoke-TestRunner
    Assert-True ($hard.ExitCode -eq 0 -and ($hard.Output -join "`n") -match "REVIEW HOLD") "terminal error did not enter review"
    Assert-True (Test-Path -LiteralPath $hardDir) "terminal error workspace was discarded"
    $hardRuntime = Get-Runtime
    Assert-True ($hardRuntime.status -eq "review") "terminal error review state was not durable"
    Assert-True ([bool]$hardRuntime.workspaceUsable) "terminal error did not record usable local files"
    Assert-True (-not [bool]$hardRuntime.conversationResumable) "terminal error incorrectly claimed the conversation was resumable"

    Reset-TestArtifacts
    Write-Output "automation: untracked failure preservation"
    $env:BORDERCLASH_FAKE_AGY_MODE = "untracked-fail"
    $untracked = Invoke-TestRunner
    Assert-True ($untracked.ExitCode -ne 0) "terminal fake failure should fail the runner invocation"
    $untrackedRuntime = Get-Runtime
    Assert-True ($untrackedRuntime.status -eq "review") "untracked failure did not enter review"
    Assert-True ([bool]$untrackedRuntime.workspaceUsable) "terminal fake failure did not record usable local files"
    Assert-True (-not [bool]$untrackedRuntime.conversationResumable) "terminal fake failure incorrectly claimed the conversation was resumable"
    Assert-True (Test-Path -LiteralPath (Join-Path ([string]$untrackedRuntime.runDir) "data\news\2024-02.jsonl")) "untracked month was lost"
    $patchFile = Get-ChildItem -LiteralPath $logDir -Filter "*.data.patch" -File | Select-Object -First 1
    Assert-True ($patchFile -and (Get-Content -LiteralPath $patchFile.FullName -Raw) -match "data/news/2024-02.jsonl") "recovery patch omitted the untracked month"

    # The agent cannot mutate runner-owned scheduling state.
    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "flip-pause"
    $stateEdit = Invoke-TestRunner
    Assert-True ($stateEdit.ExitCode -ne 0) "agent research-state edit should stop for review"
    $stateEditRuntime = Get-Runtime
    Assert-True ($stateEditRuntime.status -eq "review") "agent research-state edit did not enter review"
    Assert-True ([string]$stateEditRuntime.message -match "runner-owned data/research-state.json") "research-state ownership failure was not reported"

    # A trusted completion marker makes state assembly idempotent across runner restart.
    Reset-TestArtifacts
    $completionDir = New-RecoveryFixture "runner-completion-idempotent" -RuntimeStatus "ready" -SessionStatus "success" -Completed
    $baseState = Get-Content -LiteralPath (Join-Path $completionDir "data\research-state.json") -Raw | ConvertFrom-Json
    $finish = Read-JsonSafe (Join-Path $completionDir ".work\research-finish.json")
    $completedAt = [int64]$baseState.lastResearchAt + 12345
    $completion = [ordered]@{
        schemaVersion = 1
        cycleId = "runner-completion-idempotent"
        baseHead = (git -C $completionDir rev-parse HEAD).Trim()
        completedAt = $completedAt
        nextRunAt = $completedAt + [int64][Math]::Round(([double]$finish.intervalHours) * 3600000)
        intervalHours = [double]$finish.intervalHours
        reason = [string]$finish.reason
        researchCycleCount = [int64]$baseState.researchCycleCount + 1
    }
    [IO.File]::WriteAllText(
        (Join-Path $logDir "runner-completion-idempotent.completion.json"),
        (($completion | ConvertTo-Json -Depth 20) + [Environment]::NewLine),
        [Text.UTF8Encoding]::new($false)
    )
    $alreadyAdvanced = [ordered]@{}
    foreach ($property in $baseState.PSObject.Properties) { $alreadyAdvanced[$property.Name] = $property.Value }
    $alreadyAdvanced["systemStatus"] = "online"
    $alreadyAdvanced["lastResearchAt"] = $completion.completedAt
    $alreadyAdvanced["nextRunAt"] = $completion.nextRunAt
    $alreadyAdvanced["lastCycleInterval"] = $completion.intervalHours
    $alreadyAdvanced["schedulingReason"] = $completion.reason
    $alreadyAdvanced["researchCycleCount"] = $completion.researchCycleCount
    $alreadyAdvanced["scheduler"] = "external"
    [IO.File]::WriteAllText(
        (Join-Path $completionDir "data\research-state.json"),
        (($alreadyAdvanced | ConvertTo-Json -Depth 20) + [Environment]::NewLine),
        [Text.UTF8Encoding]::new($false)
    )
    $env:BORDERCLASH_FAKE_AGY_MODE = "fail"
    $completionRecovery = Invoke-TestRunner
    Assert-True ($completionRecovery.ExitCode -eq 0 -and ($completionRecovery.Output -join "`n") -match "SHADOW SUCCESS") "runner completion recovery did not finish without another model call"
    $afterCompletion = Get-Content -LiteralPath (Join-Path $completionDir "data\research-state.json") -Raw | ConvertFrom-Json
    Assert-True ([int64]$afterCompletion.lastResearchAt -eq $completedAt) "runner completion recovery changed completion time"
    Assert-True ([int64]$afterCompletion.researchCycleCount -eq [int64]$completion.researchCycleCount) "runner completion recovery incremented cycle count twice"

    # A completion marker inside the agent workspace is not trusted.
    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "flip-pause-workspace-marker"
    $workspaceMarker = Invoke-TestRunner
    Assert-True ($workspaceMarker.ExitCode -ne 0) "workspace-owned completion state bypassed runner state ownership"
    Assert-True ((Get-Runtime).status -eq "review") "workspace completion bypass did not enter review"

    # Explicit review survives restart and only resumes after operator action.
    Reset-TestArtifacts
    Write-Output "automation: explicit review hold"
    $env:BORDERCLASH_FAKE_AGY_MODE = "review"
    $review = Invoke-TestRunner
    Assert-True ($review.ExitCode -eq 0 -and ($review.Output -join "`n") -match "REVIEW HOLD: Fake cycle needs operator review") "agent review request was not honored"
    $reviewDir = [string](Get-Runtime).runDir
    $env:BORDERCLASH_FAKE_AGY_MODE = "fail"
    $heldReview = Invoke-TestRunner
    Assert-True ($heldReview.ExitCode -eq 0 -and ($heldReview.Output -join "`n") -match "REVIEW HOLD") "review did not survive a new runner invocation"
    Assert-True (Test-Path -LiteralPath $reviewDir) "review workspace was lost"
    $env:BORDERCLASH_FAKE_AGY_MODE = "success"
    $reviewResume = Invoke-Control "resume"
    Assert-True ($reviewResume.ExitCode -eq 0 -and ($reviewResume.Output -join "`n") -match "SHADOW SUCCESS") "operator resume did not continue the reviewed conversation"

    # Saved sessions tied to another model are preserved for review, never silently substituted.
    Reset-TestArtifacts
    Write-Output "automation: incompatible model hold"
    $legacyDir = New-RecoveryFixture "wrong-model" -RuntimeStatus "resumable" -Model "gemini-2.5-pro"
    $env:BORDERCLASH_FAKE_AGY_MODE = "fail"
    $legacy = Invoke-TestRunner
    Assert-True ($legacy.ExitCode -eq 0 -and ($legacy.Output -join "`n") -match "production requires 'gemini-3.8-flash-medium'") "incompatible model was not reported"
    Assert-True ((Get-Runtime).status -eq "review") "incompatible model did not enter review"
    Assert-True ([bool](Get-Runtime).workspaceUsable) "incompatible-model hold did not record usable local files"
    Assert-True (-not [bool](Get-Runtime).conversationResumable) "incompatible-model hold incorrectly claimed production could resume the conversation"
    Assert-True (Test-Path -LiteralPath $legacyDir) "incompatible-model workspace was discarded"
    }

    if (Test-Section "stop") {
    # Stop kills only the owned process tree and keeps the streamed conversation resumable.
    Write-Output "automation: operator stop and resume"
    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "stop-sleep"
    $runningProcess = Start-TestRunner
    Assert-True (Wait-Until {
        $runtime = Get-Runtime
        $session = if ($runtime -and $runtime.runDir) { Read-JsonSafe (Join-Path ([string]$runtime.runDir) ".work\AGY_SESSION.json") } else { $null }
        $runtime -and $runtime.status -eq "running" -and $session -and $session.conversationId
    } 12) "stop fixture did not reach streamed running state"
    $stopped = Invoke-Control "stop"
    Assert-True ($stopped.ExitCode -eq 0 -and ($stopped.Output -join "`n") -match "ownedProcessStopped=true") "stop did not terminate the owned runner tree"
    Assert-True (Wait-Until { $runningProcess.HasExited } 5) "owned runner process survived stop"
    $stoppedRuntime = Get-Runtime
    Assert-True ($stoppedRuntime.status -eq "resumable") "stop did not preserve a resumable checkpoint"
    Assert-True ([bool]$stoppedRuntime.workspaceUsable) "stop did not record that local workspace files remain usable"
    Assert-True ([bool]$stoppedRuntime.conversationResumable) "stop did not record that the saved conversation remains resumable"
    Assert-True (Test-Path -LiteralPath (Join-Path ([string]$stoppedRuntime.runDir) "data\news\2024-02.jsonl")) "operator stop discarded the untracked month"
    $env:BORDERCLASH_FAKE_AGY_MODE = "success"
    $stoppedResume = Invoke-Control "resume"
    Assert-True ($stoppedResume.ExitCode -eq 0 -and ($stoppedResume.Output -join "`n") -match "SHADOW SUCCESS") "stopped cycle did not resume"
    }

    if (Test-Section "publication-code") {
    # Publication fixtures use only local bare remotes and a fake public endpoint.
    Write-Output "automation: publication reconciliation and delivery"
    Reset-TestArtifacts
    $remoteName = "runner-code-$PID"
    $remotePath = New-TestRemote $remoteName
    Write-Output "automation: publication fixture remote ready"
    $publicUrl = Start-FakePublic $remotePath
    Write-Output "automation: publication fixture public endpoint ready"
    $env:BORDERCLASH_FAKE_AGY_MODE = "timeout-persistent"
    $codeCheckpoint = Invoke-TestRunner -Publish -RemoteName $remoteName -PublicBaseUrl $publicUrl
    Write-Output "automation: publication fixture checkpoint returned"
    Assert-True ((Get-Runtime).status -eq "resumable") "publish checkpoint fixture was not resumable"
    $codeAdvance = Push-ExternalCommit $remotePath "code"
    Write-Output "automation: publication fixture upstream code advanced"
    $env:BORDERCLASH_FAKE_AGY_MODE = "success"
    $codeResume = Invoke-TestRunner -Publish -RemoteName $remoteName -PublicBaseUrl $publicUrl
    Write-Output "automation: publication fixture resume returned"
    Assert-True ($codeResume.ExitCode -eq 0 -and ($codeResume.Output -join "`n") -match "PUBLIC VERIFIED") "code-only upstream advance did not reconcile and publish: $($codeResume.Output -join ' | ')"
    $publishedRuntime = Get-Runtime
    $delivery = Read-JsonSafe (Join-Path $logDir "$($publishedRuntime.runId).delivery.json")
    Assert-True ($null -ne $delivery) "verified publication did not write a delivery record"
    Assert-True ([int64]$delivery.cycleStartedAt -gt 0) "delivery record lost the original cycle start"
    Assert-True ([int64]$delivery.verifiedAt -gt [int64]$delivery.cycleStartedAt) "delivery record has invalid start-to-public timing"
    $codePublished = (& $realGit --git-dir=$remotePath rev-parse refs/heads/main).Trim()
    & $realGit --git-dir=$remotePath merge-base --is-ancestor $codeAdvance $codePublished
    Assert-True ($LASTEXITCODE -eq 0) "published candidate lost the upstream code-only commit"

    # Verified delivery is authoritative even if mutable runtime state drifts
    # back to a resumable status. Never reopen the published conversation.
    $resumeEventsBefore = @(Get-ChildItem -LiteralPath $logDir -Filter "$($publishedRuntime.runId).resume-*.events.ndjson" -File -ErrorAction SilentlyContinue).Count
    $publishedRuntime.status = "resumable"
    $publishedRuntime.phase = "resumable"
    $publishedRuntime.message = "stale fixture state"
    [IO.File]::WriteAllText(
        (Join-Path $runtimeDir "runtime.json"),
        (($publishedRuntime | ConvertTo-Json -Depth 20) + [Environment]::NewLine),
        [Text.UTF8Encoding]::new($false)
    )
    $stalePending = [ordered]@{
        status = "review"
        reason = "stale fixture publication review"
        runId = [string]$publishedRuntime.runId
        sourceRunDir = [string]$publishedRuntime.runDir
        baseHead = [string]$publishedRuntime.baseHead
        candidateDir = [string]$publishedRuntime.publishCandidate
        cycleStartedAt = [int64]$delivery.cycleStartedAt
    }
    [IO.File]::WriteAllText(
        (Join-Path $runtimeDir "pending-publication.json"),
        (($stalePending | ConvertTo-Json -Depth 20) + [Environment]::NewLine),
        [Text.UTF8Encoding]::new($false)
    )
    $env:BORDERCLASH_FAKE_AGY_MODE = "fail"
    $terminalReplay = Invoke-TestRunner -Publish -RemoteName $remoteName -PublicBaseUrl $publicUrl
    Assert-True ($terminalReplay.ExitCode -eq 0 -and ($terminalReplay.Output -join "`n") -match "PUBLIC VERIFIED") "verified delivery did not restore terminal published state"
    Assert-True ((Get-Runtime).status -eq "published") "verified delivery did not restore published runtime state"
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $runtimeDir "pending-publication.json"))) "verified delivery did not clear stale pending publication state"
    $resumeEventsAfter = @(Get-ChildItem -LiteralPath $logDir -Filter "$($publishedRuntime.runId).resume-*.events.ndjson" -File -ErrorAction SilentlyContinue).Count
    Assert-True ($resumeEventsAfter -eq $resumeEventsBefore) "verified published run invoked the agent again"
    }

    if (Test-Section "publication-overlap") {
    # An overlapping canonical data edit enters review and does not overwrite upstream.
    Reset-TestArtifacts
    $overlapName = "runner-overlap-$PID"
    $overlapRemote = New-TestRemote $overlapName
    $overlapPublic = Start-FakePublic $overlapRemote
    $env:BORDERCLASH_FAKE_AGY_MODE = "timeout-persistent"
    [void](Invoke-TestRunner -Publish -RemoteName $overlapName -PublicBaseUrl $overlapPublic)
    Assert-True ((Get-Runtime).status -eq "resumable") "overlap fixture was not resumable"
    $upstreamData = Push-ExternalCommit $overlapRemote "data"
    $env:BORDERCLASH_FAKE_AGY_MODE = "summary-change"
    $overlap = Invoke-TestRunner -Publish -RemoteName $overlapName -PublicBaseUrl $overlapPublic
    Assert-True ($overlap.ExitCode -eq 0) "overlapping data edit should stop cleanly for review: $($overlap.Output -join ' | ')"
    Assert-True ((Get-Runtime).status -eq "review") "overlap did not enter review"
    Assert-True (((& $realGit --git-dir=$overlapRemote rev-parse refs/heads/main).Trim()) -eq $upstreamData) "overlap incorrectly advanced remote main"
    }

    Assert-True (((& $realGit -C $repoRoot rev-parse HEAD).Trim()) -eq $headBefore) "automation tests changed developer checkout HEAD"
    Assert-True ((@(& $realGit -C $repoRoot status --porcelain) -join "`n") -eq $statusBefore) "automation tests changed developer working-tree state"
    Write-Output "run-cycle tests passed section=$Section"
}
finally {
    Remove-Item Env:BORDERCLASH_FAKE_AGY_MODE -ErrorAction SilentlyContinue
    Remove-Item Env:BORDERCLASH_EXPECT_MODEL -ErrorAction SilentlyContinue
    Remove-TestRemotes
    Reset-TestArtifacts
}
