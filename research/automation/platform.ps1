# Shared paths for development on Windows and production on Ubuntu.
$script:ResearchShell = (Get-Process -Id $PID).Path
$script:ResearchMachine = [Environment]::MachineName
$script:ResearchLocalRoot = if ($env:LOCALAPPDATA) {
    Join-Path $env:LOCALAPPDATA "BorderClash"
} elseif ($env:XDG_STATE_HOME) {
    Join-Path $env:XDG_STATE_HOME "borderclash"
} else {
    Join-Path ([Environment]::GetFolderPath("UserProfile")) ".local/state/borderclash"
}
$script:ResearchPnpm = if ($env:OS -eq "Windows_NT") { "pnpm.cmd" } else { "pnpm" }
if ($env:OS -ne "Windows_NT" -and -not $env:GIT_SSH_COMMAND) {
    $publisherKey = Join-Path ([Environment]::GetFolderPath("UserProfile")) ".config/borderclash/publish_key"
    if (Test-Path -LiteralPath $publisherKey) {
        $env:GIT_SSH_COMMAND = "ssh -i `"$publisherKey`" -o IdentitiesOnly=yes -o BatchMode=yes"
    }
}

function Resolve-ResearchAgent {
    if ($env:OS -ne "Windows_NT") {
        $unattended = Get-Command agy-unattended -ErrorAction SilentlyContinue
        if ($unattended) { return $unattended.Source }
    }
    $command = Get-Command agy -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $candidate = if ($env:LOCALAPPDATA) {
        Join-Path $env:LOCALAPPDATA "agy/bin/agy.exe"
    } else {
        Join-Path ([Environment]::GetFolderPath("UserProfile")) ".local/bin/agy"
    }
    if (Test-Path -LiteralPath $candidate) { return $candidate }
    throw "Antigravity CLI is unavailable. Install agy and authenticate on South."
}
