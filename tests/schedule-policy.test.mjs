import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const policyPath = resolve("research", "automation", "schedule-policy.ps1");

async function runPolicy(records) {
  const root = await mkdtemp(join(tmpdir(), "borderclash-schedule-policy-"));
  const logDir = join(root, "logs");
  await mkdir(logDir, { recursive: true });
  try {
    for (let index = 0; index < records.length; index += 1) {
      await writeFile(join(logDir, `${index}.delivery.json`), JSON.stringify(records[index]) + "\n", "utf8");
    }
    const scriptPath = join(root, "probe.ps1");
    const escapedPolicy = policyPath.replaceAll("'", "''");
    const escapedLog = logDir.replaceAll("'", "''");
    const script = [
      "$ErrorActionPreference = 'Stop'",
      `. '${escapedPolicy}'`,
      `$lead = Get-ResearchLeadMinutes -LogDir '${escapedLog}'`,
      "$now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()",
      "[ordered]@{",
      "  lead = $lead",
      "  warningShort = Get-ResearchCadenceWarning -IntervalHours 1 -LeadMinutes $lead",
      "  warningLong = Get-ResearchCadenceWarning -IntervalHours 4 -LeadMinutes $lead",
      "  dueBefore = Test-ResearchTimeDue -NowMs $now -NextRunAt ($now + [int64]($lead + 1) * 60000) -LeadMinutes $lead",
      "  dueAt = Test-ResearchTimeDue -NowMs $now -NextRunAt ($now + [int64]$lead * 60000) -LeadMinutes $lead",
      "  overdue = Test-ResearchTimeDue -NowMs $now -NextRunAt ($now - 60000) -LeadMinutes $lead",
      "} | ConvertTo-Json -Compress",
    ].join("\r\n");
    await writeFile(scriptPath, script, "utf8");
    const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath], {
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout.trim());
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function delivery(minutes, offset = 0) {
  const started = Date.UTC(2026, 10, 13, 0, offset, 0);
  return { status: "verified", cycleStartedAt: started, verifiedAt: started + minutes * 60_000 };
}

test("schedule policy keeps the conservative default until enough delivery samples exist", async () => {
  const empty = await runPolicy([]);
  assert.equal(empty.lead, 90);
  const sparse = await runPolicy([delivery(40), delivery(55)]);
  assert.equal(sparse.lead, 90);
});

test("schedule policy learns start-to-public duration plus buffer and exposes cadence pressure", async () => {
  const result = await runPolicy([delivery(40), delivery(55, 1), delivery(70, 2)]);
  assert.equal(result.lead, 100);
  assert.match(result.warningShort, /recent cycle-to-public lead requires about 100m/u);
  assert.equal(result.warningLong, "");
  assert.equal(result.dueBefore, false);
  assert.equal(result.dueAt, true);
  assert.equal(result.overdue, true);
});

test("schedule policy ignores invalid delivery records and caps extreme lead time", async () => {
  const result = await runPolicy([
    delivery(400),
    delivery(390, 1),
    delivery(380, 2),
    { status: "awaiting-public", cycleStartedAt: 1, verifiedAt: 999999 },
    { status: "verified", cycleStartedAt: 1000, verifiedAt: 500 },
  ]);
  assert.equal(result.lead, 360);
});
