#!/usr/bin/env bash
set -euo pipefail
repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
research_shell=$(command -v pwsh)
if [[ "$(loginctl show-user "$USER" -p Linger --value 2>/dev/null || true)" != "yes" ]]; then
  printf 'User lingering must be enabled so BorderClash can recover after reboot without an interactive login.\n' >&2
  exit 1
fi
unit_root="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
mkdir -p -- "$unit_root"
cat > "$unit_root/borderclash-research.service" <<EOF
[Unit]
Description=BorderClash research and publication

[Service]
Type=oneshot
WorkingDirectory=$repo_root
Environment=PATH=/usr/local/bin:$HOME/.local/bin:/usr/bin:/bin:/snap/bin
Environment=XDG_RUNTIME_DIR=/run/user/$(id -u)
Environment=DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u)/bus
ExecStart=$research_shell -NoProfile -File $repo_root/research/automation/run-scheduled.ps1
ExecStopPost=/usr/bin/env bash $repo_root/research/automation/rearm-scheduler.sh
TimeoutStartSec=infinity
TimeoutStopSec=45
KillMode=control-group

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable borderclash-research.service >/dev/null
"$repo_root/research/automation/rearm-scheduler.sh"
printf 'Installed and armed BorderClash one-shot research scheduling.\n'
