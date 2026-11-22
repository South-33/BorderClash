import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

const policyPath = resolve("research", "automation", "schedule-policy.ps1");
const HOUR = 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

function nextTarget({ scheduledTargetAt, completedAt, intervalHours }) {
  const escapedPolicy = policyPath.replaceAll("'", "''");
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `. '${escapedPolicy}'`,
    `Get-NextResearchTargetAt -ScheduledTargetAt ${scheduledTargetAt} -CompletedAt ${completedAt} -IntervalHours ${intervalHours}`,
  ].join("\r\n");
  const shell = process.platform === "win32" ? "powershell.exe" : "pwsh";
  const result = spawnSync(shell, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  return Number(result.stdout.trim());
}

test("scheduled cycles preserve the explicit target clock phase", () => {
  assert.equal(
    nextTarget({ scheduledTargetAt: NOW, completedAt: NOW + 2 * 60_000, intervalHours: 24 }),
    NOW + 24 * HOUR,
  );
});

test("late scheduled cycles skip missed cadence slots and return a future target", () => {
  assert.equal(
    nextTarget({ scheduledTargetAt: NOW, completedAt: NOW + 26 * HOUR, intervalHours: 24 }),
    NOW + 48 * HOUR,
  );
});

test("manual cycles anchor their next target from actual completion", () => {
  assert.equal(
    nextTarget({ scheduledTargetAt: 0, completedAt: NOW, intervalHours: 4 }),
    NOW + 4 * HOUR,
  );
});
