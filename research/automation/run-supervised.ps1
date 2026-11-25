param(
    [string]$WorkRoot = "",
    [string]$ArchiveRoot = "",
    [string]$BackupRoot = "",
    [string]$ProbeArticleId = "",
    [int]$TimeoutMinutes = 0,
    [string]$AgyPath = ""
)

. (Join-Path $PSScriptRoot "platform.ps1")

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$runner = Join-Path $PSScriptRoot "run-cycle.ps1"
$trustedResearchCli = Join-Path $repoRoot "research\cli.mjs"
$isFakeAgent = -not [string]::IsNullOrWhiteSpace($AgyPath)
if (-not $isFakeAgent -and -not [string]::Equals($script:ResearchMachine, "SouthServer", [StringComparison]::OrdinalIgnoreCase)) {
    throw "Real supervised BorderClash research may run only on SouthServer."
}

$sessionId = [DateTimeOffset]::UtcNow.ToString("yyyyMMddTHHmmssfffZ")
$sessionRoot = if ($WorkRoot) {
    [IO.Path]::GetFullPath($WorkRoot)
} else {
    Join-Path $script:ResearchLocalRoot "supervised/$sessionId"
}
$runsRoot = Join-Path $sessionRoot "runs"
$runtimeDir = Join-Path $sessionRoot "runtime"
$logDir = Join-Path $sessionRoot "logs"
$archive = [IO.Path]::GetFullPath($(if ($ArchiveRoot) { $ArchiveRoot } else { Join-Path $sessionRoot "evidence" }))
$backup = [IO.Path]::GetFullPath($(if ($BackupRoot) { $BackupRoot } else { Join-Path $sessionRoot "evidence-backup" }))
if ([string]::Equals($archive, $backup, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Supervised archive and backup roots must be different directories."
}

$repoFull = [IO.Path]::GetFullPath($repoRoot).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
$repoPrefix = $repoFull + [IO.Path]::DirectorySeparatorChar
foreach ($path in @($sessionRoot, $archive, $backup)) {
    $full = [IO.Path]::GetFullPath($path).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    if ($full -eq $repoFull -or $full.StartsWith($repoPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Supervised work and evidence roots must stay outside the Git checkout."
    }
}

New-Item -ItemType Directory -Force -Path $sessionRoot, $runsRoot, $runtimeDir, $logDir, $archive, $backup | Out-Null
$contextPath = Join-Path $sessionRoot "SUPERVISED_CONTEXT.json"
$reportPath = Join-Path $sessionRoot "SUPERVISED_REPORT.json"
$context = [ordered]@{
    schemaVersion = 1
    sessionId = $sessionId
    machine = [string]$script:ResearchMachine
    model = "gemini-4-hydrogen-medium"
    publicationEnabled = $false
    runsRoot = $runsRoot
    runtimeDir = $runtimeDir
    logDir = $logDir
    archiveRoot = $archive
    backupRoot = $backup
    startedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
}
[IO.File]::WriteAllText(
    $contextPath,
    (($context | ConvertTo-Json -Depth 10) + [Environment]::NewLine),
    [Text.UTF8Encoding]::new($false)
)

function Read-JsonSafe {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try { return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json } catch { return $null }
}

function Write-JsonAtomic {
    param([string]$Path, $Value)
    $temp = "$Path.$PID.tmp"
    [IO.File]::WriteAllText(
        $temp,
        (($Value | ConvertTo-Json -Depth 30) + [Environment]::NewLine),
        [Text.UTF8Encoding]::new($false)
    )
    Move-Item -LiteralPath $temp -Destination $Path -Force
}

function Invoke-Checked {
    param([string]$File, [string[]]$Arguments, [string]$WorkingDirectory)
    Push-Location $WorkingDirectory
    try {
        & $File @Arguments
        $code = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    if ($code -ne 0) { throw "$File exited with code $code" }
}

$oldArchive = $env:BORDERCLASH_EVIDENCE_ARCHIVE
$oldBackup = $env:BORDERCLASH_EVIDENCE_BACKUP
$cycleExit = -1
$buildPassed = $false
$probe = $null
$runtime = $null
$runDir = ""
$postCheckError = ""
$mutexName = if ($isFakeAgent) { "Global\BorderClashResearchSupervised-$sessionId" } else { "Global\BorderClashResearchCycle" }
try {
    $env:BORDERCLASH_EVIDENCE_ARCHIVE = $archive
    $env:BORDERCLASH_EVIDENCE_BACKUP = $backup

    $arguments = @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $runner,
        "-Force", "-TimeoutMinutes", [string]$TimeoutMinutes,
        "-RunsRoot", $runsRoot,
        "-RuntimeDir", $runtimeDir,
        "-LogDir", $logDir,
        "-MutexName", $mutexName
    )
    if ($AgyPath) { $arguments += @("-AgyPath", $AgyPath) }

    Write-Output "SUPERVISED: publication disabled"
    Write-Output "session=$sessionRoot"
    Write-Output "archive=$archive"
    Write-Output "backup=$backup"
    if (-not $postCheckError) {
        & $script:ResearchShell @arguments
        $cycleExit = $LASTEXITCODE

        $runtime = Read-JsonSafe (Join-Path $runtimeDir "runtime.json")
        $runDir = if ($runtime -and $runtime.PSObject.Properties["runDir"]) { [string]$runtime.runDir } else { "" }

        if ($cycleExit -eq 0 -and $runtime -and [string]$runtime.status -eq "validated" -and $runDir -and (Test-Path -LiteralPath $runDir)) {
            try {
                Invoke-Checked $script:ResearchPnpm @("install", "--frozen-lockfile") $runDir
                Invoke-Checked $script:ResearchPnpm @("build") $runDir
                $buildPassed = $true

                if ($ProbeArticleId) {
                    $probe = [ordered]@{
                        articleId = $ProbeArticleId
                        capturePassed = $false
                        verifyPassed = $false
                        restorePassed = $false
                        restoreRoot = Join-Path $sessionRoot "restore-probe"
                    }
                    Push-Location $runDir
                    try {
                        & node $trustedResearchCli "capture" $ProbeArticleId "--force"
                        $captureExit = $LASTEXITCODE
                        $probe.capturePassed = $captureExit -eq 0
                        if ($captureExit -ne 0) { throw "Evidence probe capture failed with code $captureExit" }

                        & node $trustedResearchCli "archive-verify" $ProbeArticleId
                        $verifyExit = $LASTEXITCODE
                        $probe.verifyPassed = $verifyExit -eq 0
                        if ($verifyExit -ne 0) { throw "Evidence probe verification failed with code $verifyExit" }

                        & node $trustedResearchCli "archive-restore" $ProbeArticleId ([string]$probe.restoreRoot)
                        $restoreExit = $LASTEXITCODE
                        $probe.restorePassed = $restoreExit -eq 0
                        if ($restoreExit -ne 0) { throw "Evidence probe restore failed with code $restoreExit" }
                    } finally {
                        Pop-Location
                    }
                }
            } catch {
                $postCheckError = $_.Exception.Message
            }
        } elseif ($cycleExit -eq 0) {
            $status = if ($runtime) { [string]$runtime.status } else { "missing-runtime" }
            $postCheckError = "Supervised cycle did not reach validated shadow state (status=$status)."
        }
    }

    $feedbackPath = if ($runtime -and $runtime.runId) { Join-Path $logDir "$($runtime.runId).feedback.txt" } else { "" }
    $captureLogPath = if ($runtime -and $runtime.runId) { Join-Path $logDir "$($runtime.runId).capture.json" } else { "" }
    $archiveItems = @(Get-ChildItem -LiteralPath $archive -Directory -ErrorAction SilentlyContinue)
    $backupItems = @(Get-ChildItem -LiteralPath $backup -Directory -ErrorAction SilentlyContinue)
    $probePassed = -not $ProbeArticleId -or ($probe -and $probe.capturePassed -and $probe.verifyPassed -and $probe.restorePassed)
    $passed = $cycleExit -eq 0 -and $runtime -and [string]$runtime.status -eq "validated" -and $buildPassed -and $probePassed -and -not $postCheckError
    $finalExit = if ($passed) { 0 } elseif ($cycleExit -ne 0) { $cycleExit } else { 2 }
    $report = [ordered]@{
        schemaVersion = 1
        sessionId = $sessionId
        completedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        publicationEnabled = $false
        passed = $passed
        exitCode = $finalExit
        failureReason = $postCheckError
        cycleExitCode = $cycleExit
        runtime = $runtime
        buildPassed = $buildPassed
        feedbackPath = if ($feedbackPath -and (Test-Path -LiteralPath $feedbackPath)) { $feedbackPath } else { "" }
        captureLogPath = if ($captureLogPath -and (Test-Path -LiteralPath $captureLogPath)) { $captureLogPath } else { "" }
        archiveArticleCount = $archiveItems.Count
        backupArticleCount = $backupItems.Count
        evidenceProbe = $probe
        sessionRoot = $sessionRoot
        runsRoot = $runsRoot
        runtimeDir = $runtimeDir
        logDir = $logDir
        archiveRoot = $archive
        backupRoot = $backup
        mutexName = $mutexName
    }
    Write-JsonAtomic $reportPath $report
    Write-Output "report=$reportPath"
    exit $finalExit
} finally {
    $env:BORDERCLASH_EVIDENCE_ARCHIVE = $oldArchive
    $env:BORDERCLASH_EVIDENCE_BACKUP = $oldBackup
}
