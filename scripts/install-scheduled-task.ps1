param(
    [string]$TaskName = "BorderClash Research",
    [int]$EveryMinutes = 10,
    [switch]$Publish
)

$ErrorActionPreference = "Stop"
if ($EveryMinutes -lt 5) { throw "EveryMinutes must be at least 5." }

$repoRoot = Split-Path -Parent $PSScriptRoot
$runner = Join-Path $repoRoot "scripts\run-cycle.ps1"
$publishArg = if ($Publish) { " -Publish" } else { "" }
$arguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}"{1}' -f $runner, $publishArg

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $EveryMinutes)
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Checks BorderClash nextRunAt and starts one Antigravity research cycle when due." -Force | Out-Null

Write-Output ("installed task='" + $TaskName + "' every=" + $EveryMinutes + "m publish=" + $Publish.IsPresent + " model=gemini-3.8-flash-medium logon=interactive")

