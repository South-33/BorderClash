#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
unit_root="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
timer_name="borderclash-research.timer"
timer_path="$unit_root/$timer_name"
schedule_timezone="Asia/Phnom_Penh"
dry_run=false
now_ms=""

while (($#)); do
  case "$1" in
    --dry-run)
      dry_run=true
      shift
      ;;
    --now-ms)
      now_ms="${2:?missing value for --now-ms}"
      shift 2
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

planner_args=(--repo-root "$repo_root")
if [[ -n "$now_ms" ]]; then
  planner_args+=(--now-ms "$now_ms")
fi
plan=$(node "$repo_root/research/automation/scheduler-plan.mjs" "${planner_args[@]}")
action=$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(String(p.action||""));' "$plan")
reason=$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(String(p.reason||""));' "$plan")

if [[ "$action" == "stop" ]]; then
  if $dry_run; then
    printf '%s\n' "$plan"
    exit 0
  fi
  systemctl --user disable --now "$timer_name" >/dev/null 2>&1 || true
  printf 'Scheduler stopped: %s\n' "$reason"
  exit 0
fi

wake_ms=$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(String(p.wakeAt||""));' "$plan")
if [[ ! "$wake_ms" =~ ^[0-9]+$ ]]; then
  printf 'Scheduler planner did not return a valid wakeAt: %s\n' "$plan" >&2
  exit 1
fi

wake_seconds=$((wake_ms / 1000))
wake_calendar=$(TZ="$schedule_timezone" date --date="@$wake_seconds" '+%Y-%m-%d %H:%M:%S')

if $dry_run; then
  node -e '
    const p=JSON.parse(process.argv[1]);
    p.wakeCalendar=process.argv[2];
    p.wakeTimeZone=process.argv[3];
    process.stdout.write(JSON.stringify(p)+"\n");
  ' "$plan" "$wake_calendar" "$schedule_timezone"
  exit 0
fi

mkdir -p -- "$unit_root"
temp_path="$timer_path.$$.tmp"
cat > "$temp_path" <<EOF_TIMER
[Unit]
Description=Wake BorderClash for the next research target

[Timer]
OnCalendar=$wake_calendar $schedule_timezone
Persistent=true
AccuracySec=1s
RandomizedDelaySec=0
Unit=borderclash-research.service

[Install]
WantedBy=timers.target
EOF_TIMER
mv -- "$temp_path" "$timer_path"

systemctl --user daemon-reload
systemctl --user enable "$timer_name" >/dev/null
systemctl --user restart "$timer_name"

printf 'Scheduler armed: %s (%s)\n' "$wake_calendar" "$reason"
