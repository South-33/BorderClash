import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { classifyAuditTriage, mapWithConcurrency } from "../research/lib/audit-triage.mjs";

test("audit triage compacts a captured replacement into an actionable row", () => {
  const result = classifyAuditTriage(
    { id: "event-a", date: "2026-01-01", title: "A", timeOfDay: "10:00", importance: 50 },
    {
      recoveryState: "captured-lead",
      attemptedCount: 1,
      selectedLead: { id: "lead-a", source: "Publisher", title: "Lead", captureFound: true, captureStatus: "captured-html" },
      diagnosis: {
        evidenceState: "replacement-needed",
        nextAction: "review-existing-leads",
        exactTime: { supported: false },
        citedEvidence: [{ id: "old", source: "Old", captureFound: false, captureStatus: "access-blocked" }],
      },
    },
  );

  assert.equal(result.disposition, "replacement-ready");
  assert.equal(result.selectedLead.id, "lead-a");
  assert.equal(result.exactTimeSupported, false);
  assert.equal(result.citedEvidence[0].captureStatus, "access-blocked");
});

test("audit triage identifies rows with no recoverable evidence", () => {
  const result = classifyAuditTriage(
    { id: "event-b", date: "2026-01-02", title: "B" },
    {
      recoveryState: "no-recoverable-lead",
      diagnosis: { evidenceState: "replacement-needed", nextAction: "research-replacement-source", exactTime: { supported: false } },
    },
  );
  assert.equal(result.disposition, "unresolved-candidate");
});

test("bounded concurrency preserves input order while running more than one worker", async () => {
  let active = 0;
  let peak = 0;
  const results = await mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, value % 2 ? 15 : 5));
    active -= 1;
    return value * 10;
  });
  assert.deepEqual(results, [10, 20, 30, 40]);
  assert.equal(peak, 2);
});

test("research CLI exposes the batch triage workflow", () => {
  const cli = readFileSync(new URL("../research/cli.mjs", import.meta.url), "utf8");
  assert.match(cli, /command === "audit-triage"/u);
  assert.match(cli, /audit-triage \[limit\] \[scan-limit\] \[attempts\] \[concurrency\]/u);
});
