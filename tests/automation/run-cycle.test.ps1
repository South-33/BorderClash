$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$runner = Join-Path $repoRoot "research\automation\run-cycle.ps1"
$fakeExe = Join-Path $PSScriptRoot "fake-agy.ps1"
$testRoot = Join-Path $repoRoot ".work\tests\run-cycle-$PID"
$runsRoot = Join-Path $testRoot "runs"
$runtimeDir = Join-Path $testRoot "runtime"
$logDir = Join-Path $testRoot "logs"
$mutexName = "Global\BorderClashResearchCycleTest-$PID"

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERTION FAILED: $Message" }
}

function Get-RuntimeMessage {
    $path = Join-Path $runtimeDir "runtime.json"
    if (-not (Test-Path -LiteralPath $path)) { return "" }
    try { return [string]((Get-Content -LiteralPath $path -Raw | ConvertFrom-Json).message) } catch { return "" }
}

function Invoke-TestRunner {
    param(
        [string]$AgyPath,
        [switch]$Publish,
        [string]$RemoteName = "origin",
        [string]$Model = ""
    )
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $arguments = @(
            "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $runner,
            "-Force", "-AgyPath", $AgyPath, "-TimeoutMinutes", "1",
            "-RunsRoot", $runsRoot, "-RuntimeDir", $runtimeDir, "-LogDir", $logDir,
            "-MutexName", $mutexName,
            "-RemoteName", $RemoteName
        )
        if ($Model) { $arguments += @("-Model", $Model) }
        if ($Publish) { $arguments += "-Publish" }
        $output = & powershell.exe @arguments 2>&1
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousPreference
    }
    return @{
        ExitCode = $exitCode
        Output = $output
    }
}

function Reset-TestArtifacts {
    $previousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $testRoot) {
        $full = [IO.Path]::GetFullPath($testRoot)
        $extended = if ($full.StartsWith("\\")) { "\\?\UNC\" + $full.Substring(2) } else { "\\?\" + $full }
        & cmd.exe /d /c "rd /s /q `"$extended`"" | Out-Null
    }
    $ErrorActionPreference = $previousErrorAction
}

$headBefore = (git -C $repoRoot rev-parse HEAD).Trim()
$branchesBefore = @(& git -C $repoRoot branch --format="%(refname:short)" | Where-Object { $_ })
$worktreesBefore = @(& git -C $repoRoot worktree list --porcelain |
    Where-Object { $_ -like "worktree *" } |
    ForEach-Object { $_.Substring(9).Trim() })
$job = $null
Assert-True ($runsRoot.StartsWith((Join-Path $repoRoot ".work"), [StringComparison]::OrdinalIgnoreCase)) "test runs must stay inside repo .work"
Reset-TestArtifacts

try {
    $staleRunId = "stale-recovery"
    $staleRunDir = Join-Path $runsRoot $staleRunId
    New-Item -ItemType Directory -Force -Path $runsRoot, $runtimeDir, $logDir | Out-Null
    & git clone --quiet --no-checkout --no-hardlinks $repoRoot $staleRunDir
    Assert-True ($LASTEXITCODE -eq 0) "could not create stale recovery fixture"
    & git -C $staleRunDir checkout --quiet --detach $headBefore
    Assert-True ($LASTEXITCODE -eq 0) "could not position stale recovery fixture"
    [ordered]@{
        updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        status = "running"
        runId = $staleRunId
        model = "gemini-3.8-flash-medium"
        message = "fixture"
        runDir = $staleRunDir
    } | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $runtimeDir "runtime.json")

    $env:BORDERCLASH_FAKE_AGY_MODE = "fail"
    $recovery = Invoke-TestRunner $fakeExe
    Assert-True ($recovery.ExitCode -eq 1) "post-recovery fake failure should still fail normally"
    Assert-True (-not (Test-Path -LiteralPath $staleRunDir)) "stale recovery left the interrupted run directory"
    Assert-True (Test-Path (Join-Path $logDir "$staleRunId.interrupted.json")) "stale recovery did not preserve an interruption record"

    Reset-TestArtifacts
    $activeRunId = "detached-active"
    $activeRunDir = Join-Path $runsRoot $activeRunId
    New-Item -ItemType Directory -Force -Path (Join-Path $activeRunDir ".work"), $runtimeDir, $logDir | Out-Null
    $testProcess = Get-Process -Id $PID
    [DateTimeOffset]$testProcessStarted = $testProcess.StartTime
    [IO.File]::WriteAllText(
        (Join-Path $activeRunDir ".work\AGY_SESSION.json"),
        ([ordered]@{
            status = "running"
            conversationId = "fake-live-conversation"
            agyPid = $PID
            agyStartedAt = $testProcessStarted.ToUnixTimeMilliseconds()
            model = "gemini-3.8-flash-medium"
            cwd = $activeRunDir
        } | ConvertTo-Json) + [Environment]::NewLine,
        [Text.UTF8Encoding]::new($false)
    )
    [ordered]@{
        updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        status = "running"
        runId = $activeRunId
        model = "gemini-3.8-flash-medium"
        message = "runner detached while AGY remained alive"
        runDir = $activeRunDir
        baseHead = $headBefore
    } | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $runtimeDir "runtime.json")
    $env:BORDERCLASH_FAKE_AGY_MODE = "fail"
    $activeRecovery = Invoke-TestRunner $fakeExe
    Assert-True ($activeRecovery.ExitCode -eq 0) "live detached AGY should make the replacement runner exit cleanly"
    Assert-True (($activeRecovery.Output -join "`n") -match "SKIP: detached AGY process still running") "replacement runner did not avoid racing the live AGY process"
    Assert-True (Test-Path -LiteralPath $activeRunDir) "live detached AGY workspace was removed"
    $activeRuntime = Get-Content (Join-Path $runtimeDir "runtime.json") -Raw | ConvertFrom-Json
    Assert-True ($activeRuntime.status -eq "running") "live detached AGY lost its running checkpoint"

    Reset-TestArtifacts
    $interruptedRunId = "streamed-interruption"
    $interruptedRunDir = Join-Path $runsRoot $interruptedRunId
    New-Item -ItemType Directory -Force -Path $runsRoot, $runtimeDir, $logDir | Out-Null
    & git clone --quiet --no-checkout --no-hardlinks $repoRoot $interruptedRunDir
    Assert-True ($LASTEXITCODE -eq 0) "could not create streamed-interruption fixture"
    & git -C $interruptedRunDir checkout --quiet --detach $headBefore
    Assert-True ($LASTEXITCODE -eq 0) "could not position streamed-interruption fixture"
    New-Item -ItemType Directory -Force -Path (Join-Path $interruptedRunDir ".work") | Out-Null
    Push-Location $interruptedRunDir
    try {
        $interruptedContext = & node research/cli.mjs context 2>&1
        Assert-True ($LASTEXITCODE -eq 0) "could not generate streamed-interruption context"
    } finally {
        Pop-Location
    }
    [IO.File]::WriteAllText(
        (Join-Path $interruptedRunDir ".work\CYCLE_CONTEXT.md"),
        [string]::Join([Environment]::NewLine, [string[]]$interruptedContext) + [Environment]::NewLine,
        [Text.UTF8Encoding]::new($false)
    )
    [ordered]@{
        updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        status = "running"
        runId = $interruptedRunId
        model = "gemini-3.8-flash-medium"
        message = "runner disappeared after AGY stream init"
        runDir = $interruptedRunDir
        baseHead = $headBefore
    } | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $runtimeDir "runtime.json")
    [IO.File]::WriteAllText(
        (Join-Path $interruptedRunDir ".work\AGY_SESSION.json"),
        ([ordered]@{
            status = "running"
            conversationId = "fake-interrupted-conversation"
            model = "gemini-3.8-flash-medium"
            cwd = $interruptedRunDir
            attempt = 1
            updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        } | ConvertTo-Json) + [Environment]::NewLine,
        [Text.UTF8Encoding]::new($false)
    )
    $env:BORDERCLASH_FAKE_AGY_MODE = "success"
    $interruptedRecovery = Invoke-TestRunner $fakeExe
    Assert-True ($interruptedRecovery.ExitCode -eq 0) "streamed conversation should survive an interrupted runner"
    Assert-True (($interruptedRecovery.Output -join "`n") -match "RESUME:.*fake-interrupted-conversation") "interrupted runner did not resume the streamed conversation"
    Assert-True (($interruptedRecovery.Output -join "`n") -match "SHADOW SUCCESS") "interrupted runner recovery did not validate"
    Assert-True (-not (Test-Path -LiteralPath $interruptedRunDir)) "interrupted runner recovery left its workspace behind"

    Reset-TestArtifacts
    $completedRunId = "completed-before-runner-exit"
    $completedRunDir = Join-Path $runsRoot $completedRunId
    New-Item -ItemType Directory -Force -Path $runsRoot, $runtimeDir, $logDir | Out-Null
    & git clone --quiet --no-checkout --no-hardlinks $repoRoot $completedRunDir
    Assert-True ($LASTEXITCODE -eq 0) "could not create completed-turn recovery fixture"
    & git -C $completedRunDir checkout --quiet --detach $headBefore
    Assert-True ($LASTEXITCODE -eq 0) "could not position completed-turn recovery fixture"
    New-Item -ItemType Directory -Force -Path (Join-Path $completedRunDir ".work") | Out-Null
    [IO.File]::WriteAllText(
        (Join-Path $completedRunDir ".work\CYCLE_RUN.json"),
        ([ordered]@{ runId = $completedRunId; baseHead = $headBefore; model = "gemini-3.8-flash-medium" } | ConvertTo-Json) + [Environment]::NewLine,
        [Text.UTF8Encoding]::new($false)
    )
    Push-Location $completedRunDir
    try {
        $completedContext = & node research/cli.mjs context 2>&1
        Assert-True ($LASTEXITCODE -eq 0) "could not generate completed-turn context"
        & node research/cli.mjs finish 12 "Completed before runner interruption." | Out-Null
        Assert-True ($LASTEXITCODE -eq 0) "could not finalize completed-turn fixture"
    } finally {
        Pop-Location
    }
    [IO.File]::WriteAllText(
        (Join-Path $completedRunDir ".work\CYCLE_CONTEXT.md"),
        [string]::Join([Environment]::NewLine, [string[]]$completedContext) + [Environment]::NewLine,
        [Text.UTF8Encoding]::new($false)
    )
    [ordered]@{
        updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        status = "running"
        runId = $completedRunId
        model = "gemini-3.8-flash-medium"
        message = "runner disappeared after AGY terminal success"
        runDir = $completedRunDir
        baseHead = $headBefore
    } | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $runtimeDir "runtime.json")
    [IO.File]::WriteAllText(
        (Join-Path $completedRunDir ".work\AGY_SESSION.json"),
        ([ordered]@{
            status = "success"
            conversationId = "fake-completed-conversation"
            model = "gemini-3.8-flash-medium"
            cwd = $completedRunDir
            attempts = 1
            result = [ordered]@{
                conversation_id = "fake-completed-conversation"
                status = "SUCCESS"
                response = "fake cycle complete`nHARNESS_FEEDBACK: none`n<!-- GOAL_COMPLETE -->"
            }
            updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        } | ConvertTo-Json -Depth 20) + [Environment]::NewLine,
        [Text.UTF8Encoding]::new($false)
    )
    $env:BORDERCLASH_FAKE_AGY_MODE = "fail"
    $completedRecovery = Invoke-TestRunner $fakeExe
    Assert-True ($completedRecovery.ExitCode -eq 0) "completed streamed turn should validate without another AGY call"
    Assert-True (($completedRecovery.Output -join "`n") -match "RECOVER:.*validating without another model call") "completed streamed turn did not take the no-model recovery path"
    Assert-True (($completedRecovery.Output -join "`n") -match "SHADOW SUCCESS") "completed streamed turn recovery did not validate"
    Assert-True (($completedRecovery.Output -join "`n") -notmatch "RESUME:.*fake-completed-conversation") "completed streamed turn unnecessarily resumed AGY"
    Assert-True (-not (Test-Path -LiteralPath $completedRunDir)) "completed streamed turn recovery left its workspace behind"

    Reset-TestArtifacts
    $hardErrorRunId = "hard-error-before-runner-exit"
    $hardErrorRunDir = Join-Path $runsRoot $hardErrorRunId
    New-Item -ItemType Directory -Force -Path $runsRoot, $runtimeDir, $logDir | Out-Null
    & git clone --quiet --no-checkout --no-hardlinks $repoRoot $hardErrorRunDir
    Assert-True ($LASTEXITCODE -eq 0) "could not create hard-error recovery fixture"
    & git -C $hardErrorRunDir checkout --quiet --detach $headBefore
    Assert-True ($LASTEXITCODE -eq 0) "could not position hard-error recovery fixture"
    New-Item -ItemType Directory -Force -Path (Join-Path $hardErrorRunDir ".work") | Out-Null
    [ordered]@{
        updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        status = "running"
        runId = $hardErrorRunId
        model = "gemini-3.8-flash-medium"
        message = "runner disappeared after terminal hard error"
        runDir = $hardErrorRunDir
        baseHead = $headBefore
    } | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $runtimeDir "runtime.json")
    [IO.File]::WriteAllText(
        (Join-Path $hardErrorRunDir ".work\AGY_SESSION.json"),
        ([ordered]@{
            status = "error"
            conversationId = "fake-hard-error-conversation"
            model = "gemini-3.8-flash-medium"
            cwd = $hardErrorRunDir
            exitCode = 23
            result = [ordered]@{ conversation_id = "fake-hard-error-conversation"; status = "ERROR"; error = "terminal fake failure" }
            agyError = [ordered]@{ status = "INVALID_ARGUMENT"; retryable = $false }
            updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        } | ConvertTo-Json -Depth 20) + [Environment]::NewLine,
        [Text.UTF8Encoding]::new($false)
    )
    $env:BORDERCLASH_FAKE_AGY_MODE = "success"
    $hardErrorRecovery = Invoke-TestRunner $fakeExe
    Assert-True ($hardErrorRecovery.ExitCode -eq 0) "hard-error recovery should discard the failed conversation and start fresh"
    Assert-True (($hardErrorRecovery.Output -join "`n") -match "DROP:.*non-retryable AGY error") "hard-error recovery did not report dropping the terminal failure"
    Assert-True (($hardErrorRecovery.Output -join "`n") -notmatch "RESUME:.*fake-hard-error-conversation") "hard-error recovery incorrectly resumed a terminal failure"
    Assert-True (($hardErrorRecovery.Output -join "`n") -match "SHADOW SUCCESS") "fresh cycle after hard-error recovery did not validate"
    Assert-True (-not (Test-Path -LiteralPath $hardErrorRunDir)) "hard-error workspace survived cleanup"

    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "fail"
    $failure = Invoke-TestRunner $fakeExe
    Assert-True ($failure.ExitCode -eq 1) "fake CLI failure must fail the cycle"
    Assert-True (((git -C $repoRoot rev-parse HEAD).Trim()) -eq $headBefore) "failed cycle changed main HEAD"
    Assert-True (@(Get-ChildItem $runsRoot -Directory -ErrorAction SilentlyContinue).Count -eq 0) "failed cycle left a disposable run directory"
    Assert-True ($null -ne (Get-ChildItem $logDir -File -Filter "*.data.patch" | Select-Object -First 1)) "failed cycle did not preserve a diagnostic data patch"

    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "timeout-resume"
    $timedOut = Invoke-TestRunner $fakeExe
    Assert-True ($timedOut.ExitCode -eq 0) "recoverable print timeout should continue inside the same runner"
    Assert-True (($timedOut.Output -join "`n") -match "RETRY: print_timeout.*fake-timeout-conversation") "timeout did not immediately continue the streamed conversation"
    Assert-True (($timedOut.Output -join "`n") -match "SHADOW SUCCESS") "immediate timeout continuation did not validate"
    $timeoutRuntime = Get-Content (Join-Path $runtimeDir "runtime.json") -Raw | ConvertFrom-Json
    Assert-True ($timeoutRuntime.status -eq "validated") "successful timeout continuation remained checkpointed"
    $timeoutEvents = Get-ChildItem $logDir -File -Filter "*.events.ndjson" | Select-Object -First 1
    Assert-True ($null -ne $timeoutEvents) "runner did not preserve AGY stream events"
    Assert-True (@(Get-Content $timeoutEvents.FullName | Where-Object { $_ -match '"event":"result"' }).Count -ge 2) "timeout continuation did not preserve both terminal attempt events"

    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "timeout-persistent"
    $persistentTimeout = Invoke-TestRunner $fakeExe
    Assert-True ($persistentTimeout.ExitCode -eq 0) "repeated timeout should checkpoint after one immediate continuation"
    Assert-True (($persistentTimeout.Output -join "`n") -match "DEFERRED: print_timeout") "repeated timeout did not create scheduler fallback state"
    $persistentRuntime = Get-Content (Join-Path $runtimeDir "runtime.json") -Raw | ConvertFrom-Json
    Assert-True ($persistentRuntime.status -eq "resumable") "repeated timeout fallback was not resumable"
    $persistentRunDir = [string]$persistentRuntime.runDir
    $persistentResume = Invoke-TestRunner $fakeExe
    Assert-True ($persistentResume.ExitCode -eq 0) "scheduler fallback did not resume the persistent timeout cycle"
    Assert-True (($persistentResume.Output -join "`n") -match "RESUME:.*fake-persistent-conversation") "scheduler fallback did not reuse the saved conversation"
    Assert-True (($persistentResume.Output -join "`n") -match "SHADOW SUCCESS") "scheduler fallback did not finish the cycle"
    Assert-True (-not (Test-Path -LiteralPath $persistentRunDir)) "successful scheduler fallback left its workspace behind"

    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "timeout-persistent"
    $staleCheckpoint = Invoke-TestRunner $fakeExe
    Assert-True ($staleCheckpoint.ExitCode -eq 0) "stale-checkpoint fixture did not create a resumable cycle"
    Assert-True (($staleCheckpoint.Output -join "`n") -match "RETRY: print_timeout") "repeated timeout did not try an immediate continuation first"
    Assert-True (($staleCheckpoint.Output -join "`n") -match "DEFERRED: print_timeout") "repeated timeout did not fall back to a durable checkpoint"
    $staleRuntimePath = Join-Path $runtimeDir "runtime.json"
    $staleRuntime = Get-Content $staleRuntimePath -Raw | ConvertFrom-Json
    Assert-True ($staleRuntime.status -eq "resumable") "repeated timeout did not leave a resumable checkpoint"
    $staleRunDir = [string]$staleRuntime.runDir
    $staleRuntime.baseHead = "0000000000000000000000000000000000000000"
    $staleRuntime | ConvertTo-Json | Set-Content -Encoding utf8 $staleRuntimePath
    $env:BORDERCLASH_FAKE_AGY_MODE = "success"
    $freshAfterAdvance = Invoke-TestRunner $fakeExe
    Assert-True ($freshAfterAdvance.ExitCode -eq 0) "stale resumable checkpoint should fall back to a fresh cycle"
    Assert-True (($freshAfterAdvance.Output -join "`n") -match "ABANDON RESUME: base advanced") "runner did not explain why the stale checkpoint was abandoned"
    Assert-True (-not (Test-Path -LiteralPath $staleRunDir)) "stale checkpoint workspace survived base invalidation"

    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "retryable-resume"
    $capacity = Invoke-TestRunner $fakeExe
    Assert-True ($capacity.ExitCode -eq 0) "retryable provider failure should continue inside the same runner"
    Assert-True (($capacity.Output -join "`n") -match "RETRY: retryable:UNAVAILABLE.*fake-retryable-conversation") "retryable provider failure was not immediately continued"
    Assert-True (($capacity.Output -join "`n") -match "SHADOW SUCCESS") "provider retry did not complete the cycle"
    $capacityRuntime = Get-Content (Join-Path $runtimeDir "runtime.json") -Raw | ConvertFrom-Json
    Assert-True ($capacityRuntime.status -eq "validated") "successful provider retry remained checkpointed"

    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "success"
    $env:BORDERCLASH_EXPECT_MODEL = "gemini-3.8-flash-high"
    $modelOverride = Invoke-TestRunner $fakeExe -Model $env:BORDERCLASH_EXPECT_MODEL
    Assert-True ($modelOverride.ExitCode -eq 0) "explicit research model override should pass through to AGY"
    Remove-Item Env:BORDERCLASH_EXPECT_MODEL -ErrorAction SilentlyContinue

    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "missing-feedback"
    $missingFeedback = Invoke-TestRunner $fakeExe
    Assert-True ($missingFeedback.ExitCode -ne 0) "cycle without required harness feedback should fail"
    $missingFeedbackMessage = Get-RuntimeMessage
    Assert-True ($missingFeedbackMessage -match "required HARNESS_FEEDBACK") "missing-feedback failure did not name the invariant: $missingFeedbackMessage"
    $missingFeedbackFile = Get-ChildItem $logDir -File -Filter "*.feedback.txt" | Select-Object -First 1
    Assert-True ($null -ne $missingFeedbackFile) "missing feedback was not preserved for diagnosis"
    Assert-True ((Get-Content $missingFeedbackFile.FullName -Raw).Trim() -eq "missing") "missing feedback log did not preserve the diagnostic state"

    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "stale-state"
    $staleState = Invoke-TestRunner $fakeExe
    Assert-True ($staleState.ExitCode -eq 1) "cycle without scheduler-state advancement must fail"
    $staleStateMessage = Get-RuntimeMessage
    Assert-True ($staleStateMessage -match "did not advance lastResearchAt") "stale-state failure did not name the invariant: $staleStateMessage"
    Assert-True (((git -C $repoRoot rev-parse HEAD).Trim()) -eq $headBefore) "stale-state cycle changed main HEAD"

    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "invalid-data"
    $invalid = Invoke-TestRunner $fakeExe
    Assert-True ($invalid.ExitCode -eq 1) "invalid canonical data must fail validation"
    Assert-True (((git -C $repoRoot rev-parse HEAD).Trim()) -eq $headBefore) "validation failure changed main HEAD"

    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "non-data"
    $nonData = Invoke-TestRunner $fakeExe
    Assert-True ($nonData.ExitCode -eq 1) "routine cycle must reject non-data edits"
    $nonDataMessage = Get-RuntimeMessage
    Assert-True ($nonDataMessage -match "Routine research may only change data/") "non-data rejection did not name the boundary: $nonDataMessage"
    Assert-True (((git -C $repoRoot rev-parse HEAD).Trim()) -eq $headBefore) "rejected repo change advanced main HEAD"

    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "flip-pause"
    $pause = Invoke-TestRunner $fakeExe
    Assert-True ($pause.ExitCode -eq 0) "valid pause-control cycle should pass"
    $pauseOutput = $pause.Output -join "`n"
    Assert-True ($pauseOutput -match "SHADOW SUCCESS") "pause-control cycle did not reach validated shadow state"
    Assert-True (((git -C $repoRoot rev-parse HEAD).Trim()) -eq $headBefore) "pause-control shadow cycle advanced main HEAD"

    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "unicode"
    $unicode = Invoke-TestRunner $fakeExe
    Assert-True ($unicode.ExitCode -eq 0) "UTF-8 fake cycle should pass"
    $unicodeLog = Get-ChildItem $logDir -File -Filter "*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    Assert-True ($null -ne $unicodeLog) "UTF-8 fake cycle did not write a JSON log"
    $unicodeText = [IO.File]::ReadAllText($unicodeLog.FullName, [Text.Encoding]::UTF8)
    $thaiExpected = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("4LiX4LiU4Liq4Lit4Lia4Lig4Liy4Lip4Liy4LmE4LiX4Lii"))
    $khmerExpected = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("4Z6f4Z624Z6A4Z6b4Z+S4Z6U4Z6E4Z6X4Z624Z6f4Z624Z6B4Z+S4Z6Y4Z+C4Z6a"))
    Assert-True ($unicodeText.Contains($thaiExpected)) "runner corrupted Thai AGY output"
    Assert-True ($unicodeText.Contains($khmerExpected)) "runner corrupted Khmer AGY output"
    Assert-True (((git -C $repoRoot rev-parse HEAD).Trim()) -eq $headBefore) "UTF-8 shadow cycle changed main HEAD"

    $defaultFeedback = Get-ChildItem $logDir -File -Filter "*.feedback.txt" | Select-Object -First 1
    Assert-True ($null -ne $defaultFeedback) "successful cycle did not preserve harness feedback"

    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "feedback"
    $feedbackCycle = Invoke-TestRunner $fakeExe
    Assert-True ($feedbackCycle.ExitCode -eq 0) "harness-feedback cycle should pass"
    Assert-True ($null -ne (Get-ChildItem $logDir -File -Filter "*.context.md" | Select-Object -First 1)) "runner did not preserve cycle context"
    Assert-True ($null -ne (Get-ChildItem $logDir -File -Filter "*.prompt.txt" | Select-Object -First 1)) "runner did not preserve cycle prompt"
    Assert-True ($null -ne (Get-ChildItem $logDir -File -Filter "*.data.patch" | Select-Object -First 1)) "runner did not preserve research data diff"
    $feedbackFile = Get-ChildItem $logDir -File -Filter "*.feedback.txt" | Select-Object -First 1
    Assert-True ($null -ne $feedbackFile) "runner did not extract HARNESS_FEEDBACK"
    Assert-True ((Get-Content $feedbackFile.FullName -Raw).Trim() -eq "Fake harness feedback.") "runner changed HARNESS_FEEDBACK text"

    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "missing-feedback"
    $missingFeedback = Invoke-TestRunner $fakeExe
    Assert-True ($missingFeedback.ExitCode -ne 0) "cycle without mandatory harness feedback should fail"
    $missingFeedbackMessage = Get-RuntimeMessage
    Assert-True ($missingFeedbackMessage -match "required HARNESS_FEEDBACK") "missing-feedback failure did not name the invariant: $missingFeedbackMessage"
    $missingFeedbackFile = Get-ChildItem $logDir -File -Filter "*.feedback.txt" | Select-Object -First 1
    Assert-True ($null -ne $missingFeedbackFile) "missing feedback was not preserved for diagnosis"
    Assert-True ((Get-Content $missingFeedbackFile.FullName -Raw).Trim() -eq "missing") "missing feedback log did not preserve the diagnostic state"

    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "sleep"
    $job = Start-Job -ScriptBlock {
        param($runnerPath, $agyPath, $testRunsRoot, $testRuntimeDir, $testLogDir, $testMutexName)
        $env:BORDERCLASH_FAKE_AGY_MODE = "sleep"
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runnerPath -Force -AgyPath $agyPath -TimeoutMinutes 1 -RunsRoot $testRunsRoot -RuntimeDir $testRuntimeDir -LogDir $testLogDir -MutexName $testMutexName 2>&1
        exit $LASTEXITCODE
    } -ArgumentList $runner, $fakeExe, $runsRoot, $runtimeDir, $logDir, $mutexName

    $observedRunning = $false
    for ($attempt = 0; $attempt -lt 100; $attempt++) {
        $runtimePath = Join-Path $runtimeDir "runtime.json"
        if (Test-Path $runtimePath) {
            try {
                $runtimeState = Get-Content $runtimePath -Raw | ConvertFrom-Json
                if ($runtimeState.status -eq "running") {
                    $observedRunning = $true
                    break
                }
            } catch { }
        }
        Start-Sleep -Milliseconds 100
    }
    Assert-True $observedRunning "first lock-holder never reached running state"
    $second = Invoke-TestRunner $fakeExe
    if ($second.ExitCode -ne 0) {
        Write-Output ("second trigger exit=" + $second.ExitCode)
        Write-Output ($second.Output -join "`n")
    }
    Assert-True ($second.ExitCode -eq 0) "overlapping trigger should exit cleanly"
    Assert-True (($second.Output -join "`n") -match "SKIP: already-running") "overlapping trigger did not observe mutex"

    Wait-Job $job | Out-Null
    $firstOutput = Receive-Job $job
    Assert-True ($job.State -eq "Completed") "first lock-holder job did not complete"
    Assert-True (($firstOutput -join "`n") -match "SHADOW SUCCESS") "first fake cycle did not complete normally"

    Assert-True (((git -C $repoRoot rev-parse HEAD).Trim()) -eq $headBefore) "shadow tests changed main HEAD"

    Reset-TestArtifacts
    $publishRemoteName = "runner-test-$PID"
    $publishRemotePath = Join-Path $testRoot "remote.git"
    New-Item -ItemType Directory -Force -Path $testRoot | Out-Null
    & git init --bare $publishRemotePath | Out-Null
    Assert-True ($LASTEXITCODE -eq 0) "could not create publish test remote"
    & git -C $repoRoot remote add $publishRemoteName $publishRemotePath
    Assert-True ($LASTEXITCODE -eq 0) "could not add publish test remote"
    & git -C $repoRoot push $publishRemoteName "${headBefore}:refs/heads/main" | Out-Null
    Assert-True ($LASTEXITCODE -eq 0) "could not seed publish test remote"

    $statusBeforePublish = (@(& git -C $repoRoot status --porcelain) -join "`n")
    $env:BORDERCLASH_FAKE_AGY_MODE = "success"
    $published = Invoke-TestRunner $fakeExe -Publish -RemoteName $publishRemoteName
    Assert-True ($published.ExitCode -eq 0) "publish cycle should succeed with a dirty developer checkout: $($published.Output -join ' | ')"
    Assert-True (($published.Output -join "`n") -match "PUBLISHED:") "publish cycle did not report publication"
    Assert-True (((git -C $repoRoot rev-parse HEAD).Trim()) -eq $headBefore) "publish cycle changed developer checkout HEAD"
    $statusAfterPublish = (@(& git -C $repoRoot status --porcelain) -join "`n")
    Assert-True ($statusAfterPublish -eq $statusBeforePublish) "publish cycle changed developer working-tree state"
    $publishedHead = (& git --git-dir=$publishRemotePath rev-parse refs/heads/main).Trim()
    Assert-True ($publishedHead -ne $headBefore) "publish cycle did not advance remote main"

    & git -C $repoRoot remote remove $publishRemoteName
    Assert-True ($LASTEXITCODE -eq 0) "could not remove publish test remote"
    $addedBranches = @(& git -C $repoRoot branch --format="%(refname:short)" | Where-Object { $_ -and $_ -notin $branchesBefore })
    $addedWorktrees = @(& git -C $repoRoot worktree list --porcelain |
        Where-Object { $_ -like "worktree *" } |
        ForEach-Object { $_.Substring(9).Trim() } |
        Where-Object { $_ -notin $worktreesBefore })
    Assert-True ($addedBranches.Count -eq 0) "runner created a repository branch: $($addedBranches -join ', ')"
    Assert-True ($addedWorktrees.Count -eq 0) "runner created a Git worktree: $($addedWorktrees -join ', ')"
    Write-Output "run-cycle tests passed"
}
finally {
    if ($null -ne $job) {
        Remove-Job $job -Force -ErrorAction SilentlyContinue
    }
    Remove-Item Env:BORDERCLASH_FAKE_AGY_MODE -ErrorAction SilentlyContinue
    if ($null -ne (git -C $repoRoot remote | Where-Object { $_ -eq "runner-test-$PID" })) {
        & git -C $repoRoot remote remove "runner-test-$PID" 2>$null | Out-Null
    }
    Reset-TestArtifacts
}

$addedBranches = @(& git -C $repoRoot branch --format="%(refname:short)" | Where-Object { $_ -and $_ -notin $branchesBefore })
$addedWorktrees = @(& git -C $repoRoot worktree list --porcelain |
    Where-Object { $_ -like "worktree *" } |
    ForEach-Object { $_.Substring(9).Trim() } |
    Where-Object { $_ -notin $worktreesBefore })
Assert-True ($addedBranches.Count -eq 0) "test run left a repository branch: $($addedBranches -join ', ')"
Assert-True ($addedWorktrees.Count -eq 0) "test run left a Git worktree: $($addedWorktrees -join ', ')"

