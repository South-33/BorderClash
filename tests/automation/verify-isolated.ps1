param(
    [ValidateSet("start", "status")]
    [string]$Action = "start",
    [ValidateSet("recovery", "controls", "stop", "publication-code", "publication-overlap", "automation", "node", "full")]
    [string]$Target = "recovery",
    [string]$Ref = "HEAD",
    [switch]$IncludeWorkingTree,
    [string]$RunId = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$verificationRoot = Join-Path $repoRoot ".work\verifications"
New-Item -ItemType Directory -Force -Path $verificationRoot | Out-Null

function Write-JsonFile {
    param([string]$Path, $Value)
    [IO.File]::WriteAllText(
        $Path,
        (($Value | ConvertTo-Json -Depth 20) + [Environment]::NewLine),
        [Text.UTF8Encoding]::new($false)
    )
}

function Get-RunRoot {
    param([string]$Id)
    if ($Id -notmatch '^[A-Za-z0-9._-]+$') { throw "Invalid verification run id" }
    $path = [IO.Path]::GetFullPath((Join-Path $verificationRoot $Id))
    $prefix = [IO.Path]::GetFullPath($verificationRoot).TrimEnd('\') + '\'
    if (-not $path.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Verification run path escaped the owned root"
    }
    return $path
}

function Show-Status {
    param([string]$Id)
    if (-not $Id) { throw "status requires -RunId" }
    $root = Get-RunRoot $Id
    $metadataPath = Join-Path $root "metadata.json"
    if (-not (Test-Path -LiteralPath $metadataPath)) { throw "Unknown verification run: $Id" }
    $metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
    $exitPath = Join-Path $root "exit.txt"
    $stdoutPath = Join-Path $root "stdout.log"
    $stderrPath = Join-Path $root "stderr.log"
    $status = if (Test-Path -LiteralPath $exitPath) { "finished" } else { "running" }
    $exitCode = if ($status -eq "finished") { [int](Get-Content -LiteralPath $exitPath -Raw).Trim() } else { $null }
    [ordered]@{
        runId = $Id
        status = $status
        exitCode = $exitCode
        target = [string]$metadata.target
        ref = [string]$metadata.ref
        snapshotHead = [string]$metadata.snapshotHead
        includeWorkingTree = [bool]$metadata.includeWorkingTree
        checkout = [string]$metadata.checkout
        stdout = $stdoutPath
        stderr = $stderrPath
    } | ConvertTo-Json -Depth 10
    if (Test-Path -LiteralPath $stdoutPath) {
        Write-Output "--- stdout tail ---"
        Get-Content -LiteralPath $stdoutPath -Tail 120
    }
    if (Test-Path -LiteralPath $stderrPath) {
        $stderr = @(Get-Content -LiteralPath $stderrPath -Tail 120)
        if ($stderr.Count) {
            Write-Output "--- stderr tail ---"
            $stderr
        }
    }
}

if ($Action -eq "status") {
    Show-Status $RunId
    $root = Get-RunRoot $RunId
    $exitPath = Join-Path $root "exit.txt"
    if (Test-Path -LiteralPath $exitPath) {
        $code = [int](Get-Content -LiteralPath $exitPath -Raw).Trim()
        if ($code -ne 0) { exit $code }
    }
    exit 0
}

$snapshotHead = (& git -C $repoRoot rev-parse $Ref).Trim()
if ($LASTEXITCODE -ne 0 -or -not $snapshotHead) { throw "Could not resolve verification ref: $Ref" }
$id = if ($RunId) {
    $RunId
} else {
    "{0}-{1}-{2}" -f ([DateTimeOffset]::UtcNow.ToString("yyyyMMddTHHmmssfffZ")), $Target, $PID
}
$runRoot = Get-RunRoot $id
if (Test-Path -LiteralPath $runRoot) { throw "Verification run already exists: $id" }
$checkout = Join-Path $runRoot "checkout"
New-Item -ItemType Directory -Force -Path $runRoot | Out-Null

& git clone --quiet --no-checkout --no-hardlinks $repoRoot $checkout
if ($LASTEXITCODE -ne 0) { throw "Could not create isolated verification clone" }
& git -C $checkout config core.autocrlf false
& git -C $checkout config core.safecrlf false
& git -C $checkout checkout --quiet --detach $snapshotHead
if ($LASTEXITCODE -ne 0) { throw "Could not checkout verification ref" }

if ($IncludeWorkingTree) {
    $tracked = @(& git -C $repoRoot diff --name-only --no-renames $snapshotHead --)
    if ($LASTEXITCODE -ne 0) { throw "Could not enumerate tracked working-tree changes" }
    foreach ($relative in $tracked) {
        if (-not $relative) { continue }
        $source = Join-Path $repoRoot $relative
        $destination = Join-Path $checkout $relative
        if (Test-Path -LiteralPath $source) {
            $parent = Split-Path -Parent $destination
            if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
            Copy-Item -LiteralPath $source -Destination $destination -Force
        } elseif (Test-Path -LiteralPath $destination) {
            Remove-Item -LiteralPath $destination -Force
        }
    }
    $untracked = @(& git -C $repoRoot ls-files --others --exclude-standard)
    if ($LASTEXITCODE -ne 0) { throw "Could not snapshot untracked files" }
    foreach ($relative in $untracked) {
        if (-not $relative) { continue }
        $source = Join-Path $repoRoot $relative
        $destination = Join-Path $checkout $relative
        $parent = Split-Path -Parent $destination
        if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
        Copy-Item -LiteralPath $source -Destination $destination
    }
}

$metadata = [ordered]@{
    schemaVersion = 1
    runId = $id
    createdAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    target = $Target
    ref = $Ref
    snapshotHead = $snapshotHead
    includeWorkingTree = [bool]$IncludeWorkingTree
    checkout = $checkout
}
Write-JsonFile (Join-Path $runRoot "metadata.json") $metadata

$runnerPath = Join-Path $runRoot "run.ps1"
$stdoutPath = Join-Path $runRoot "stdout.log"
$stderrPath = Join-Path $runRoot "stderr.log"
$exitPath = Join-Path $runRoot "exit.txt"
$commands = switch ($Target) {
    "recovery" { @("& powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests\automation\run-cycle.test.ps1 -Section recovery") }
    "controls" { @("& powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests\automation\run-cycle.test.ps1 -Section controls") }
    "stop" { @("& powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests\automation\run-cycle.test.ps1 -Section stop") }
    "publication-code" { @("& powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests\automation\run-cycle.test.ps1 -Section publication-code") }
    "publication-overlap" { @("& powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests\automation\run-cycle.test.ps1 -Section publication-overlap") }
    "automation" { @("& pnpm test:automation") }
    "node" { @("& pnpm test") }
    "full" { @("& pnpm test", "& pnpm validate", "& pnpm test:automation", "& pnpm build", "& git diff --check") }
}

$body = @(
    '$ErrorActionPreference = "Continue"',
    "Set-Location -LiteralPath '$($checkout.Replace("'", "''"))'",
    '$exitCode = 0'
)
foreach ($command in $commands) {
    $body += ('if ($exitCode -eq 0) { ' + $command + '; $exitCode = $LASTEXITCODE }')
}
$escapedExitPath = $exitPath.Replace("'", "''")
$body += ("[IO.File]::WriteAllText('$escapedExitPath', [string]" + '$exitCode' + " + [Environment]::NewLine, [Text.Encoding]::ASCII)")
$body += 'exit $exitCode'
[IO.File]::WriteAllText(
    $runnerPath,
    [string]::Join([Environment]::NewLine, $body) + [Environment]::NewLine,
    [Text.UTF8Encoding]::new($false)
)

$process = Start-Process powershell.exe -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $runnerPath
) -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -WindowStyle Hidden -PassThru

[ordered]@{
    runId = $id
    pid = $process.Id
    target = $Target
    snapshotHead = $snapshotHead
    includeWorkingTree = [bool]$IncludeWorkingTree
    statusCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests\automation\verify-isolated.ps1 -Action status -RunId $id"
} | ConvertTo-Json -Depth 10
