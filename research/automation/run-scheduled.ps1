param(
    [string]$RemoteName = "origin"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Invoke-Checked {
    param([string]$FilePath, [string[]]$Arguments)

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$FilePath exited with code $LASTEXITCODE"
    }
}

# This is a dedicated production checkout. Always run the current
# committed production code; research state and scratch live outside tracked
# files or are committed by run-cycle.ps1.
Invoke-Checked "git" @("-C", $repoRoot, "fetch", $RemoteName, "main")
Invoke-Checked "git" @("-C", $repoRoot, "checkout", "--quiet", "main")
Invoke-Checked "git" @("-C", $repoRoot, "reset", "--hard", "$RemoteName/main")

$runner = Join-Path $repoRoot "research\automation\run-cycle.ps1"
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner -Publish -RemoteName $RemoteName
exit $LASTEXITCODE
