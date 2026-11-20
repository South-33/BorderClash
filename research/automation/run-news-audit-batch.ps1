param(
    [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)]
    [string[]]$RecordId
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$runner = Join-Path $PSScriptRoot "run-news-audit-batch.mjs"
$ids = @($RecordId | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ })
if ($ids.Count -lt 2 -or $ids.Count -gt 4) { throw "News audit batch requires 2 to 4 record ids." }
if (@($ids | Select-Object -Unique).Count -ne $ids.Count) { throw "News audit batch record ids must be unique." }

$gitCommonDir = ([string](& git -C $repoRoot rev-parse --path-format=absolute --git-common-dir)).Trim()
if (-not $gitCommonDir) { throw "Could not resolve Git common directory for audit-review lock" }

function Get-MutexHash([string]$Seed) {
    $bytes = [Text.Encoding]::UTF8.GetBytes($Seed)
    $sha256 = [Security.Cryptography.SHA256]::Create()
    try {
        return -join ($sha256.ComputeHash($bytes) | ForEach-Object { $_.ToString("x2") })
    } finally {
        $sha256.Dispose()
    }
}

$recordMutexes = @()
$slot = $null
$slotHeld = $false
try {
    foreach ($id in ($ids | Sort-Object)) {
        $hash = Get-MutexHash "$gitCommonDir|$id"
        $mutex = [Threading.Mutex]::new($false, "BorderClashAuditReview-$hash")
        $held = $false
        try {
            $held = $mutex.WaitOne(0)
        } catch [Threading.AbandonedMutexException] {
            $held = $true
        }
        if (-not $held) {
            $mutex.Dispose()
            throw "Audit review already running for $id in this repository."
        }
        $recordMutexes += [pscustomobject]@{ Mutex = $mutex; Held = $true }
    }

    $slotHash = Get-MutexHash "$gitCommonDir|audit-review-model-slot"
    $slot = [Threading.Mutex]::new($false, "BorderClashAuditReviewSlot-$slotHash")
    try {
        $slotHeld = $slot.WaitOne()
    } catch [Threading.AbandonedMutexException] {
        $slotHeld = $true
    }

    & (Get-Command node).Source $runner @ids
    if ($LASTEXITCODE -ne 0) { throw "News audit batch failed." }
} finally {
    if ($slotHeld -and $slot) { $slot.ReleaseMutex() }
    if ($slot) { $slot.Dispose() }
    foreach ($entry in $recordMutexes) {
        if ($entry.Held) { $entry.Mutex.ReleaseMutex() }
        $entry.Mutex.Dispose()
    }
}
