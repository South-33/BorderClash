$RESEARCH_START_LEAD_MINUTES = 10

function Get-ResearchCadenceWarning {
    param([double]$IntervalHours, [int]$LeadMinutes)

    if ($IntervalHours -le 0 -or $LeadMinutes -le 0) { return "" }
    $intervalMinutes = [Math]::Round($IntervalHours * 60)
    if ($intervalMinutes -le $LeadMinutes) {
        return "Requested cadence is ${intervalMinutes}m, but the configured pre-target start lead is ${LeadMinutes}m."
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

function Get-NextResearchTargetAt {
    param(
        [int64]$PreviousTargetAt,
        [int64]$LastResearchAt,
        [int64]$CompletedAt,
        [double]$IntervalHours,
        [int]$LeadMinutes = $RESEARCH_START_LEAD_MINUTES
    )

    if ($CompletedAt -le 0) { throw "CompletedAt must be positive." }
    if ($IntervalHours -le 0 -or $IntervalHours -gt 168) {
        throw "IntervalHours must be between 0 and 168."
    }
    $intervalMs = [int64][Math]::Round($IntervalHours * 3600000)
    $leadMs = [int64][Math]::Max(0, $LeadMinutes) * 60 * 1000
    $hasCurrentTarget = $PreviousTargetAt -gt $LastResearchAt
    $completedInTargetWindow = $hasCurrentTarget -and $CompletedAt -ge ($PreviousTargetAt - $leadMs)
    $anchorAt = if ($completedInTargetWindow) { $PreviousTargetAt } else { $CompletedAt }
    $nextRunAt = $anchorAt + $intervalMs
    while ($nextRunAt -le $CompletedAt) {
        $nextRunAt += $intervalMs
    }
    return [int64]$nextRunAt
}
