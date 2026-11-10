$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$runner = Join-Path $repoRoot "ops\run-cycle.ps1"
$fakeExe = Join-Path $PSScriptRoot "fake-agy.cmd"
$testRoot = Join-Path $repoRoot ".work\tests\run-cycle-$PID"
$runsRoot = Join-Path $testRoot "runs"
$runtimeDir = Join-Path $testRoot "runtime"
$logDir = Join-Path $testRoot "logs"
$mutexName = "Global\BorderClashResearchCycleTest-$PID"

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERTION FAILED: $Message" }
}

function Invoke-TestRunner {
    param(
        [string]$AgyPath,
        [switch]$Publish,
        [string]$RemoteName = "origin"
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
        param($runnerPath, $agyPath, $testRunsRoot, $testRuntimeDir, $testLogDir, $testMutexName)
        $env:BORDERCLASH_FAKE_AGY_MODE = "sleep"
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runnerPath -Force -AgyPath $agyPath -TimeoutMinutes 1 -RunsRoot $testRunsRoot -RuntimeDir $testRuntimeDir -LogDir $testLogDir -MutexName $testMutexName 2>&1
        exit $LASTEXITCODE
    } -ArgumentList $runner, $fakeExe, $runsRoot, $runtimeDir, $logDir, $mutexName

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

