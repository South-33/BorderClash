param(
    [string]$RemoteName = "origin"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$statePath = Join-Path $repoRoot "data\research-state.json"
$runtimePath = Join-Path $repoRoot ".work\runner\runtime\runtime.json"
$script:preflightMessage = $null

function Test-ResearchDue {
    if (-not (Test-Path -LiteralPath $statePath)) { return $true }

    try {
        $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    } catch {
        # Let the normal sync/runner path repair or report malformed state.
        return $true
    }

    if ($state.isPaused) {
        $script:preflightMessage = "SKIP: paused (local preflight)"
        return $false
    }

    if (Test-Path -LiteralPath $runtimePath) {
        try {
            $runtime = Get-Content -LiteralPath $runtimePath -Raw | ConvertFrom-Json
            if ([string]$runtime.status -eq "resumable") { return $true }
        } catch { }
    }

    $nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    if ($state.nextRunAt -and [int64]$state.nextRunAt -gt $nowMs) {
        $next = [DateTimeOffset]::FromUnixTimeMilliseconds([int64]$state.nextRunAt).ToLocalTime()
        $script:preflightMessage = "SKIP: not-due nextRunAt=$($next.ToString('o')) (local preflight)"
        return $false
    }

    return $true
}

function Invoke-Checked {
    param([string]$FilePath, [string[]]$Arguments)

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$FilePath exited with code $LASTEXITCODE"
    }
}

# The Windows task polls frequently so a due cycle starts promptly. Avoid
# waking Git/network/Node on every idle poll; the dedicated production checkout
# owns this scheduler state, so the local state is sufficient until a cycle is
# actually due. The normal runner still re-checks the synced state below.
if (-not (Test-ResearchDue)) {
    Write-Output $script:preflightMessage
    exit 0
}

# This is a dedicated production checkout. When work is due, always run the
# current committed production code; research state and scratch live outside
# tracked files or are committed by run-cycle.ps1.
Invoke-Checked "git" @("-C", $repoRoot, "fetch", $RemoteName, "main")
Invoke-Checked "git" @("-C", $repoRoot, "checkout", "--quiet", "main")
Invoke-Checked "git" @("-C", $repoRoot, "reset", "--hard", "$RemoteName/main")

$runner = Join-Path $repoRoot "research\automation\run-cycle.ps1"
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner -Publish -RemoteName $RemoteName
exit $LASTEXITCODE
