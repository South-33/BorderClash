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
    Get-ChildItem $runsRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        & git -C $repoRoot worktree remove --force $_.FullName 2>$null | Out-Null
    }
    & git -C $repoRoot for-each-ref --format="%(refname:short)" "refs/heads/$branchPrefix/" | ForEach-Object {
        $name = $_.Trim()
        if ($name) { & git -C $repoRoot branch -D $name 2>$null | Out-Null }
    }
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
    $ErrorActionPreference = $previousErrorAction
}

$headBefore = (git -C $repoRoot rev-parse HEAD).Trim()
$job = $null
Assert-True ($runsRoot.StartsWith((Join-Path $repoRoot ".work"), [StringComparison]::OrdinalIgnoreCase)) "test runs must stay inside repo .work"
Reset-TestArtifacts

try {
    $env:BORDERCLASH_FAKE_AGY_MODE = "fail"
    $failure = Invoke-TestRunner $fakeExe
    Assert-True ($failure.ExitCode -eq 1) "fake CLI failure must fail the cycle"
    Assert-True (((git -C $repoRoot rev-parse HEAD).Trim()) -eq $headBefore) "failed cycle changed main HEAD"

    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "invalid-data"
    $invalid = Invoke-TestRunner $fakeExe
    Assert-True ($invalid.ExitCode -eq 1) "invalid canonical data must fail validation"
    Assert-True (((git -C $repoRoot rev-parse HEAD).Trim()) -eq $headBefore) "validation failure changed main HEAD"

    Reset-TestArtifacts
    $env:BORDERCLASH_FAKE_AGY_MODE = "non-data"
    $nonData = Invoke-TestRunner $fakeExe
    Assert-True ($nonData.ExitCode -eq 0) "valid repo-level cleanup should be allowed in shadow mode"
    Assert-True (($nonData.Output -join "`n") -match "SHADOW SUCCESS") "repo-level cleanup did not reach validated shadow state"
    Assert-True (((git -C $repoRoot rev-parse HEAD).Trim()) -eq $headBefore) "shadow repo change advanced main HEAD"

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
    Assert-True (($firstOutput -join "`n") -match "SUCCESS: no changes") "first fake cycle did not complete normally"

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

