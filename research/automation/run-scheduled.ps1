param(
    [string]$RemoteName = "origin",
    [int]$FetchAttempts = 6,
    [int]$FetchRetrySeconds = 30
)

. (Join-Path $PSScriptRoot "platform.ps1")

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
if ($FetchAttempts -lt 1 -or $FetchAttempts -gt 20) { throw "FetchAttempts must be between 1 and 20." }
if ($FetchRetrySeconds -lt 0 -or $FetchRetrySeconds -gt 300) { throw "FetchRetrySeconds must be between 0 and 300." }

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$statePath = Join-Path $repoRoot "data\research-state.json"
$runtimePath = Join-Path $repoRoot ".work\runner\runtime\runtime.json"
$controlPath = Join-Path $repoRoot ".work\runner\runtime\control.json"
$logDir = Join-Path $repoRoot ".work\runner\logs"
$script:preflightMessage = $null
$defaultLeadMinutes = 90
. (Join-Path $PSScriptRoot "schedule-policy.ps1")
$script:leadMinutes = Get-ResearchLeadMinutes -LogDir $logDir -DefaultLeadMinutes $defaultLeadMinutes

function Read-JsonSafe {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try { return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json } catch { return $null }
}

function Write-RuntimeBlock {
    param([string]$Message)
    $runtimeDir = Split-Path -Parent $runtimePath
    New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
    $payload = [ordered]@{
        updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        status = "review"
        phase = "review"
        runId = ""
        model = "gemini-3.8-flash-medium"
        message = $Message
        runDir = ""
        recoveryReason = "production_checkout_dirty"
    }
    $temp = "$runtimePath.$PID.tmp"
    [IO.File]::WriteAllText($temp, ($payload | ConvertTo-Json -Depth 20) + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temp -Destination $runtimePath -Force
}

function Test-ResearchDue {
    if (-not (Test-Path -LiteralPath $statePath)) { return $true }

    $state = Read-JsonSafe $statePath
    if ($null -eq $state) {
        # Let the normal sync/runner path repair or report malformed state.
        return $true
    }

    $control = Read-JsonSafe $controlPath
    if ($control -and $control.stopped) {
        $script:preflightMessage = "SKIP: stopped by operator"
        return $false
    }

    if (Test-Path -LiteralPath $runtimePath) {
        $runtime = Read-JsonSafe $runtimePath
        if ($runtime) {
            if ([string]$runtime.status -in @("running", "resumable", "ready", "pending-publication")) { return $true }
            if ([string]$runtime.status -eq "review") {
                $script:preflightMessage = "SKIP: review hold - $([string]$runtime.message)"
                return $false
            }
        }
    }

    if (($control -and $control.paused) -or $state.isPaused) {
        $script:preflightMessage = "SKIP: paused"
        return $false
    }

    $nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    if ($state.nextRunAt -and -not (Test-ResearchTimeDue -NowMs $nowMs -NextRunAt ([int64]$state.nextRunAt) -LeadMinutes $script:leadMinutes)) {
        $next = [DateTimeOffset]::FromUnixTimeMilliseconds([int64]$state.nextRunAt).ToLocalTime()
        $script:preflightMessage = "SKIP: not-due nextRunAt=$($next.ToString('o')) lead=$($script:leadMinutes)m"
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

function Invoke-BoundedFetch {
    for ($attempt = 1; $attempt -le $FetchAttempts; $attempt++) {
        $previousErrorAction = $ErrorActionPreference
        try {
            $ErrorActionPreference = "Continue"
            $output = @(& git -C $repoRoot fetch $RemoteName main 2>&1)
            $exitCode = $LASTEXITCODE
        } finally {
            $ErrorActionPreference = $previousErrorAction
        }
        if ($exitCode -eq 0) { return }
        $detail = ([string]::Join([Environment]::NewLine, [string[]]$output)).Trim()
        if ($attempt -ge $FetchAttempts) {
            if (-not $detail) { $detail = "no diagnostic output" }
            throw "git fetch failed after $FetchAttempts bounded attempts: $detail"
        }
        Write-Warning "git fetch attempt $attempt/$FetchAttempts failed; retrying in $FetchRetrySeconds seconds"
        if ($FetchRetrySeconds -gt 0) { Start-Sleep -Seconds $FetchRetrySeconds }
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

# Preserve a production checkout that someone has edited. Automatic recovery
# must never erase local work to get back to origin/main.
$dirty = @(& git -C $repoRoot status --porcelain)
if ($LASTEXITCODE -ne 0) { throw "Could not inspect production checkout status" }
if (@($dirty | Where-Object { $_ }).Count -gt 0) {
    $message = "Production checkout is dirty; automatic sync is blocked until an operator reviews it."
    Write-RuntimeBlock $message
    Write-Output "BLOCKED: $message"
    exit 0
}

# This is a dedicated production checkout. Update only by fast-forward.
Invoke-BoundedFetch
Invoke-Checked "git" @("-C", $repoRoot, "checkout", "--quiet", "main")
Invoke-Checked "git" @("-C", $repoRoot, "merge", "--ff-only", "$RemoteName/main")

$runner = Join-Path $repoRoot "research\automation\run-cycle.ps1"
& $script:ResearchShell -NoProfile -ExecutionPolicy Bypass -File $runner -Publish -RemoteName $RemoteName -StartLeadMinutes $script:leadMinutes
exit $LASTEXITCODE
