#!/usr/bin/env bash
set -euo pipefail
repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
research_shell=$(command -v pwsh)
unit_root="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
mkdir -p -- "$unit_root"
cat > "$unit_root/borderclash-research.service" <<EOF
[Unit]
Description=BorderClash research and publication
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$repo_root
Environment=PATH=/usr/local/bin:$HOME/.local/bin:/usr/bin:/bin:/snap/bin
Environment=XDG_RUNTIME_DIR=/run/user/$(id -u)
Environment=DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u)/bus
ExecStart=$research_shell -NoProfile -File $repo_root/research/automation/run-scheduled.ps1
TimeoutStartSec=infinity
TimeoutStopSec=45
KillMode=control-group
EOF
cat > "$unit_root/borderclash-research.timer" <<'EOF'
[Unit]
Description=Check BorderClash research every five minutes

[Timer]
OnBootSec=2min
OnUnitInactiveSec=5min
Persistent=true
Unit=borderclash-research.service

[Install]
WantedBy=timers.target
EOF
systemctl --user daemon-reload
printf 'Installed. Enable with systemctl --user enable --now borderclash-research.timer\n'
