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
$runtimePath = Join-Path $repoRoot ".work\runner\runtime\runtime.json"
$schedulerPlanner = Join-Path $PSScriptRoot "scheduler-plan.mjs"
$script:preflightMessage = $null

function Write-RuntimeBlock {
    param([string]$Message)
    $runtimeDir = Split-Path -Parent $runtimePath
    New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
    $payload = [ordered]@{
        updatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        status = "review"
        phase = "review"
        runId = ""
        model = "gemini-4-hydrogen-medium"
        message = $Message
        runDir = ""
        recoveryReason = "production_checkout_dirty"
    }
    $temp = "$runtimePath.$PID.tmp"
    [IO.File]::WriteAllText($temp, ($payload | ConvertTo-Json -Depth 20) + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temp -Destination $runtimePath -Force
}

function Get-SchedulerPlan {
    $output = @(& node $schedulerPlanner "--repo-root" $repoRoot 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "Scheduler planner failed: $([string]::Join([Environment]::NewLine, [string[]]$output))"
    }
    try {
        return ([string]($output | Select-Object -Last 1) | ConvertFrom-Json)
    } catch {
        throw "Scheduler planner returned invalid JSON."
    }
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

function Test-SharedCredentialReady {
    if ($env:OS -eq "Windows_NT") { return $true }

    $gdbus = Get-Command gdbus -ErrorAction SilentlyContinue
    if (-not $gdbus) {
        $script:preflightMessage = "SKIP: shared credential service check is unavailable"
        return $false
    }

    $owner = @(
        & $gdbus.Source call --session `
            --dest org.freedesktop.DBus `
            --object-path /org/freedesktop/DBus `
            --method org.freedesktop.DBus.NameHasOwner `
            org.freedesktop.secrets 2>$null
    )
    if ($LASTEXITCODE -ne 0 -or ([string]::Join("", [string[]]$owner)) -notmatch "true") {
        $script:preflightMessage = "SKIP: shared credential service is not ready"
        return $false
    }

    $credentialReady = $false
    foreach ($collectionPath in @(
        "/org/freedesktop/secrets/collection/login",
        "/org/freedesktop/secrets/aliases/default"
    )) {
        $locked = @(
            & $gdbus.Source call --session `
                --dest org.freedesktop.secrets `
                --object-path $collectionPath `
                --method org.freedesktop.DBus.Properties.Get `
                org.freedesktop.Secret.Collection Locked 2>$null
        )
        if ($LASTEXITCODE -eq 0 -and ([string]::Join("", [string[]]$locked)) -match "<false>") {
            $credentialReady = $true
            break
        }
    }
    if (-not $credentialReady) {
        $script:preflightMessage = "SKIP: shared credential collections are locked or unavailable"
        return $false
    }

    return $true
}

# The planner owns all due/hold/recovery timing. A boot-time service start and
# the exact timer both pass through this same decision before touching network.
$schedulerPlan = Get-SchedulerPlan
if (-not [bool]$schedulerPlan.runDue) {
    Write-Output "SKIP: scheduler $([string]$schedulerPlan.reason)"
    exit 0
}

if (-not (Test-SharedCredentialReady)) {
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

# Re-evaluate after syncing main so a newer pause/target can cancel a stale
# local wake without starting a cycle.
$schedulerPlan = Get-SchedulerPlan
if (-not [bool]$schedulerPlan.runDue) {
    Write-Output "SKIP: scheduler $([string]$schedulerPlan.reason)"
    exit 0
}

$scheduledTargetAt = 0
if ($schedulerPlan.PSObject.Properties["targetAt"] -and $null -ne $schedulerPlan.targetAt) {
    $scheduledTargetAt = [int64]$schedulerPlan.targetAt
}
$runner = Join-Path $repoRoot "research\automation\run-cycle.ps1"
& $script:ResearchShell -NoProfile -ExecutionPolicy Bypass -File $runner -Publish -RemoteName $RemoteName -ScheduledTargetAt $scheduledTargetAt
exit $LASTEXITCODE
