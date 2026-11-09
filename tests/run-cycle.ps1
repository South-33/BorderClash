$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runner = Join-Path $repoRoot "scripts\run-cycle.ps1"
$fakeExe = Join-Path $PSScriptRoot "fake-agy.cmd"
$testRoot = Join-Path $repoRoot ".work\tests\run-cycle-$PID"
$runsRoot = Join-Path $testRoot "runs"
$runtimeDir = Join-Path $testRoot "runtime"
$logDir = Join-Path $testRoot "logs"
$mutexName = "Global\BorderClashResearchCycleTest-$PID"
$branchPrefix = "test-cycle-$PID"

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERTION FAILED: $Message" }
}

function Invoke-TestRunner {
    param([string]$AgyPath)
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner -Force -AgyPath $AgyPath -TimeoutMinutes 1 -RunsRoot $runsRoot -RuntimeDir $runtimeDir -LogDir $logDir -MutexName $mutexName -BranchPrefix $branchPrefix 2>&1
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
    $registeredWorktrees = @(& git -C $repoRoot worktree list --porcelain 2>$null) |
        Where-Object { $_ -like "worktree *" } |
        ForEach-Object { $_.Substring(9).Trim() } |
        Where-Object { $_.StartsWith($testRoot, [StringComparison]::OrdinalIgnoreCase) }
    foreach ($path in $registeredWorktrees) {
        for ($attempt = 0; $attempt -lt 5; $attempt++) {
            & git -C $repoRoot worktree remove --force $path 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) { break }
            Start-Sleep -Milliseconds 200
        }
    }
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
    & git -C $repoRoot worktree prune --expire now 2>$null | Out-Null
    & git -C $repoRoot for-each-ref --format="%(refname:short)" "refs/heads/$branchPrefix/" | ForEach-Object {
        $name = $_.Trim()
        if ($name) { & git -C $repoRoot branch -D $name 2>$null | Out-Null }
    }
    $ErrorActionPreference = $previousErrorAction
}

$headBefore = (git -C $repoRoot rev-parse HEAD).Trim()
$job = $null
Assert-True ($runsRoot.StartsWith((Join-Path $repoRoot ".work"), [StringComparison]::OrdinalIgnoreCase)) "test runs must stay inside repo .work"
Reset-TestArtifacts

try {
    $staleRunId = "stale-recovery"
    $staleWorktree = Join-Path $runsRoot $staleRunId
    $staleBranch = "$branchPrefix/$staleRunId"
    New-Item -ItemType Directory -Force -Path $runsRoot, $runtimeDir, $logDir | Out-Null
    & git -C $repoRoot worktree add -b $staleBranch $staleWorktree $headBefore | Out-Null
    Assert-True ($LASTEXITCODE -eq 0) "could not create stale recovery fixture"
    [ordered]@{
        updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        status = "running"
        runId = $staleRunId
        model = "gemini-3.8-flash-medium"
        message = "fixture"
        worktree = $staleWorktree
        branch = $staleBranch
    } | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $runtimeDir "runtime.json")

    $env:BORDERCLASH_FAKE_AGY_MODE = "fail"
    $recovery = Invoke-TestRunner $fakeExe
    Assert-True ($recovery.ExitCode -eq 1) "post-recovery fake failure should still fail normally"
    Assert-True (-not (Test-Path -LiteralPath $staleWorktree)) "stale recovery left the interrupted worktree directory"
    $staleRegistered = @(
        @(& git -C $repoRoot worktree list --porcelain) | Where-Object {
            $_ -like "worktree *" -and $_.Substring(9).Trim().Equals($staleWorktree, [StringComparison]::OrdinalIgnoreCase)
        }
    )
    Assert-True ($staleRegistered.Count -eq 0) "stale recovery left the interrupted worktree registered"
    & git -C $repoRoot show-ref --verify --quiet "refs/heads/$staleBranch"
    Assert-True ($LASTEXITCODE -ne 0) "stale recovery left the interrupted branch"
    Assert-True (Test-Path (Join-Path $logDir "$staleRunId.interrupted.json")) "stale recovery did not preserve an interruption record"

    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "fail"
    $failure = Invoke-TestRunner $fakeExe
    Assert-True ($failure.ExitCode -eq 1) "fake CLI failure must fail the cycle"
    Assert-True (((git -C $repoRoot rev-parse HEAD).Trim()) -eq $headBefore) "failed cycle changed main HEAD"

    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "stale-state"
    $staleState = Invoke-TestRunner $fakeExe
    Assert-True ($staleState.ExitCode -eq 1) "cycle without scheduler-state advancement must fail"
    Assert-True (($staleState.Output -join "`n") -match "did not advance lastResearchAt") "stale-state failure did not name the invariant: $($staleState.Output -join ' | ')"
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
    Assert-True (($nonData.Output -join "`n") -match "Routine research may only change data/") "non-data rejection did not name the boundary"
    Assert-True (((git -C $repoRoot rev-parse HEAD).Trim()) -eq $headBefore) "rejected repo change advanced main HEAD"

    Reset-TestArtifacts
    $rootPaused = [bool]((Get-Content (Join-Path $repoRoot "data\state.json") -Raw | ConvertFrom-Json).isPaused)
    $env:BORDERCLASH_FAKE_AGY_MODE = "flip-pause"
    $pause = Invoke-TestRunner $fakeExe
    Assert-True ($pause.ExitCode -eq 0) "valid pause-control cycle should pass"
    $pauseOutput = $pause.Output -join "`n"
    Assert-True ($pauseOutput -match "SHADOW SUCCESS") "pause-control cycle did not reach validated shadow state"
    $worktreeMatch = [regex]::Match($pauseOutput, '(?m)^worktree=(.+)$')
    Assert-True $worktreeMatch.Success "pause-control cycle did not report its worktree"
    $pauseWorktree = $worktreeMatch.Groups[1].Value.Trim()
    $cyclePaused = [bool]((Get-Content (Join-Path $pauseWorktree "data\state.json") -Raw | ConvertFrom-Json).isPaused)
    Assert-True ($cyclePaused -eq $rootPaused) "runner did not preserve operator pause state"
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

    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "note"
    $note = Invoke-TestRunner $fakeExe
    Assert-True ($note.ExitCode -eq 0) "harness-note cycle should pass"
    $noteFile = Get-ChildItem $logDir -File -Filter "*.note.txt" | Select-Object -First 1
    Assert-True ($null -ne $noteFile) "runner did not extract HARNESS_NOTE"
    Assert-True ((Get-Content $noteFile.FullName -Raw).Trim() -eq "Fake harness feedback.") "runner changed HARNESS_NOTE text"

    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "sleep"
    $job = Start-Job -ScriptBlock {
        param($runnerPath, $agyPath, $testRunsRoot, $testRuntimeDir, $testLogDir, $testMutexName, $testBranchPrefix)
        $env:BORDERCLASH_FAKE_AGY_MODE = "sleep"
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runnerPath -Force -AgyPath $agyPath -TimeoutMinutes 1 -RunsRoot $testRunsRoot -RuntimeDir $testRuntimeDir -LogDir $testLogDir -MutexName $testMutexName -BranchPrefix $testBranchPrefix 2>&1
        exit $LASTEXITCODE
    } -ArgumentList $runner, $fakeExe, $runsRoot, $runtimeDir, $logDir, $mutexName, $branchPrefix

    Start-Sleep -Seconds 2
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
    Write-Output "run-cycle tests passed"
}
finally {
    if ($null -ne $job) {
        Remove-Job $job -Force -ErrorAction SilentlyContinue
    }
    Remove-Item Env:BORDERCLASH_FAKE_AGY_MODE -ErrorAction SilentlyContinue
    Reset-TestArtifacts
}

$leftoverWorktree = @(@(& git -C $repoRoot worktree list --porcelain) | Where-Object {
    $_ -like "worktree *" -and $_.Substring(9).Trim().StartsWith($testRoot, [StringComparison]::OrdinalIgnoreCase)
})
$leftoverBranch = @(@(& git -C $repoRoot for-each-ref --format="%(refname:short)" "refs/heads/$branchPrefix/") | Where-Object { $_.Trim() })
Assert-True ($leftoverWorktree.Count -eq 0) "test cleanup left a registered worktree"
Assert-True ($leftoverBranch.Count -eq 0) "test cleanup left a branch"

