param(
    [string]$TaskName = "BorderClashResearch",
    [int]$EveryMinutes = 10
)

$ErrorActionPreference = "Stop"
if ($EveryMinutes -lt 5) { throw "EveryMinutes must be at least 5." }

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$runner = Join-Path $repoRoot "research\automation\run-scheduled.ps1"
$arguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $runner

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments -WorkingDirectory $repoRoot
$recurring = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $EveryMinutes)
$logon = New-ScheduledTaskTrigger -AtLogOn -User ([Security.Principal.WindowsIdentity]::GetCurrent().Name)
$settings = New-ScheduledTaskSettingsSet `
    -MultipleInstances IgnoreNew `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$principal = New-ScheduledTaskPrincipal `
    -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger @($recurring, $logon) `
    -Settings $settings `
    -Principal $principal `
    -Description "Keeps the BorderClash production checkout on main and runs one due AGY research cycle." `
    -Force | Out-Null

Write-Output "installed task='$TaskName' every=${EveryMinutes}m with logon recovery"
