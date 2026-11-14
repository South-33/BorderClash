function Read-DeliveryDurationMinutes {
    param([string]$Path)

    try {
        $record = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    } catch {
        return $null
    }
    if (
        [string]$record.status -ne "verified" -or
        -not $record.PSObject.Properties["cycleStartedAt"] -or
        -not $record.PSObject.Properties["verifiedAt"]
    ) {
        return $null
    }
    $started = [int64]$record.cycleStartedAt
    $verified = [int64]$record.verifiedAt
    if ($started -le 0 -or $verified -le $started) { return $null }
    return [Math]::Ceiling(($verified - $started) / 60000.0)
}

function Get-ResearchLeadMinutes {
    param(
        [string]$LogDir,
        [int]$DefaultLeadMinutes = 90,
        [int]$BufferMinutes = 30,
        [int]$MinimumLeadMinutes = 30,
        [int]$MaximumLeadMinutes = 360,
        [int]$MinimumSamples = 3,
        [int]$SampleLimit = 10
    )

    if (-not $LogDir -or -not (Test-Path -LiteralPath $LogDir)) { return $DefaultLeadMinutes }
    $durations = @(
        Get-ChildItem -LiteralPath $LogDir -Filter "*.delivery.json" -File -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First $SampleLimit |
            ForEach-Object { Read-DeliveryDurationMinutes $_.FullName } |
            Where-Object { $null -ne $_ }
    )
    if ($durations.Count -lt $MinimumSamples) { return $DefaultLeadMinutes }
    $observed = [int](($durations | Measure-Object -Maximum).Maximum)
    return [Math]::Max($MinimumLeadMinutes, [Math]::Min($MaximumLeadMinutes, $observed + $BufferMinutes))
}

function Get-ResearchCadenceWarning {
    param([double]$IntervalHours, [int]$LeadMinutes)

    if ($IntervalHours -le 0 -or $LeadMinutes -le 0) { return "" }
    $intervalMinutes = [Math]::Round($IntervalHours * 60)
    if ($intervalMinutes -le $LeadMinutes) {
        return "Requested cadence is ${intervalMinutes}m, but recent cycle-to-public lead requires about ${LeadMinutes}m."
    }
    return ""
}

function Test-ResearchTimeDue {
    param(
        [int64]$NowMs,
        [int64]$NextRunAt,
        [int]$LeadMinutes
    )

    if ($NextRunAt -le 0) { return $true }
    $leadMs = [int64][Math]::Max(0, $LeadMinutes) * 60 * 1000
    return ($NextRunAt - $leadMs) -le $NowMs
}
