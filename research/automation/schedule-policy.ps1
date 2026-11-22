function Get-NextResearchTargetAt {
    param(
        [int64]$ScheduledTargetAt,
        [int64]$CompletedAt,
        [double]$IntervalHours
    )

    if ($CompletedAt -le 0) { throw "CompletedAt must be positive." }
    if ($IntervalHours -le 0 -or $IntervalHours -gt 168) {
        throw "IntervalHours must be between 0 and 168."
    }
    $intervalMs = [int64][Math]::Round($IntervalHours * 3600000)
    $anchorAt = if ($ScheduledTargetAt -gt 0) { $ScheduledTargetAt } else { $CompletedAt }
    $nextRunAt = $anchorAt + $intervalMs
    while ($nextRunAt -le $CompletedAt) {
        $nextRunAt += $intervalMs
    }
    return [int64]$nextRunAt
}
