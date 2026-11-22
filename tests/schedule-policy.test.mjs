import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";

const policyPath = resolve("research", "automation", "schedule-policy.ps1");

function runPolicy() {
  const escapedPolicy = policyPath.replaceAll("'", "''");
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `. '${escapedPolicy}'`,
    "$lead = [int]$RESEARCH_START_LEAD_MINUTES",
    "$now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()",
    "[ordered]@{",
    "  lead = $lead",
    "  warningShort = Get-ResearchCadenceWarning -IntervalHours 1 -LeadMinutes $lead",
    "  warningLong = Get-ResearchCadenceWarning -IntervalHours 4 -LeadMinutes $lead",
    "  dueBefore = Test-ResearchTimeDue -NowMs $now -NextRunAt ($now + [int64]($lead + 1) * 60000) -LeadMinutes $lead",
    "  dueAt = Test-ResearchTimeDue -NowMs $now -NextRunAt ($now + [int64]$lead * 60000) -LeadMinutes $lead",
    "  overdue = Test-ResearchTimeDue -NowMs $now -NextRunAt ($now - 60000) -LeadMinutes $lead",
    "  anchoredLate = Get-NextResearchTargetAt -PreviousTargetAt $now -LastResearchAt ($now - 86400000) -CompletedAt ($now + 120000) -IntervalHours 24 -LeadMinutes $lead",
    "  anchoredEarly = Get-NextResearchTargetAt -PreviousTargetAt $now -LastResearchAt ($now - 86400000) -CompletedAt ($now - 300000) -IntervalHours 24 -LeadMinutes $lead",
    "  manualEarly = Get-NextResearchTargetAt -PreviousTargetAt ($now + 14400000) -LastResearchAt ($now - 86400000) -CompletedAt $now -IntervalHours 4 -LeadMinutes $lead",
    "} | ConvertTo-Json -Compress",
  ].join("\r\n");
  const shell = process.platform === "win32" ? "powershell.exe" : "pwsh";
  const result = spawnSync(shell, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout.trim());
}

test("schedule policy uses the fixed ten-minute product lead", () => {
  const result = runPolicy();
  assert.equal(result.lead, 10);
  assert.equal(result.warningShort, "");
  assert.equal(result.warningLong, "");
});

test("schedule policy gates the target window and preserves scheduled clock phase", () => {
  const result = runPolicy();
  assert.equal(result.dueBefore, false);
  assert.equal(result.dueAt, true);
  assert.equal(result.overdue, true);
  assert.equal(result.anchoredEarly, result.anchoredLate);
  assert.equal(result.anchoredLate - result.manualEarly, 20 * 60 * 60 * 1000);
  assert.equal(result.manualEarly > 0, true);
});
