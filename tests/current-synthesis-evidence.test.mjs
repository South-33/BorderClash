import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const readJsonl = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);

test("current synthesis is refreshed and evidence-linked through November 14", () => {
  const summary = readJson("data/current/summary.json");
  const thailand = readJson("data/current/thailand.json");
  const cambodia = readJson("data/current/cambodia.json");
  const timeline = readJsonl("data/timeline/2026-11.jsonl");

  assert.ok(summary.updatedAt >= Date.parse("2026-11-14T00:00:00Z"));
  assert.ok(thailand.updatedAt >= Date.parse("2026-11-14T00:00:00Z"));
  assert.ok(cambodia.updatedAt >= Date.parse("2026-11-14T00:00:00Z"));

  assert.match(summary.summary, /border remains calm/u);
  assert.match(summary.summary, /Francophonie/u);
  assert.match(summary.summary, /Joint Boundary Commission/u);
  assert.doesNotMatch(summary.summary, /foreign ministers.*Beijing/iu);

  assert.equal(summary.keyUpdates.length, 4);
  assert.equal(summary.keyUpdates.every((item) => Array.isArray(item.evidenceIds) && item.evidenceIds.length > 0), true);
  assert.equal(summary.keyUpdatesTh, undefined);
  assert.equal(summary.keyUpdatesKh, undefined);
  assert.ok(summary.summaryEvidenceIds.includes("a19b2fa33ec68f62f98b968e9ccdd798"));
  assert.ok(summary.summaryEvidenceIds.includes("9ec429eb3271d277c3019ba8cfc04db2"));

  assert.ok(thailand.summaryEvidenceIds.includes("1b74fc2f24abb855829e964f656dd8b2"));
  assert.ok(thailand.summaryEvidenceIds.includes("a19b2fa33ec68f62f98b968e9ccdd798"));
  assert.ok(thailand.activityEvidenceIds.length > 0);
  assert.ok(cambodia.summaryEvidenceIds.includes("324ba2aec0b55f2d385bca51c6f10c7c"));
  assert.ok(cambodia.summaryEvidenceIds.includes("9ec429eb3271d277c3019ba8cfc04db2"));
  assert.ok(cambodia.activityEvidenceIds.includes("1b74fc2f24abb855829e964f656dd8b2"));

  const event = timeline.find((row) => row.id === "ddf3984eecb9b92b2e21f742a9eb9ac9");
  assert.ok(event);
  assert.equal(event.date, "2026-11-14");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, ["a19b2fa33ec68f62f98b968e9ccdd798"]);
  assert.match(event.description, /Thai military allegations.*not independently verified/u);
});
