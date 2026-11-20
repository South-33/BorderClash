import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const readJsonl = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);

test("current synthesis is refreshed and evidence-linked through November 19", () => {
  const summary = readJson("data/current/summary.json");
  const thailand = readJson("data/current/thailand.json");
  const cambodia = readJson("data/current/cambodia.json");
  const timeline = readJsonl("data/timeline/2026-11.jsonl");

  assert.ok(summary.updatedAt >= Date.parse("2026-11-19T00:00:00Z"));
  assert.ok(thailand.updatedAt >= Date.parse("2026-11-19T00:00:00Z"));
  assert.ok(cambodia.updatedAt >= Date.parse("2026-11-19T00:00:00Z"));

  assert.match(summary.summary, /border remains calm/u);
  assert.match(summary.summary, /PCA.*November 24-27/u);
  assert.match(summary.summary, /November 19.*Border Pillar No\. 2/u);
  assert.match(summary.summary, /Joint Boundary Commission \(JBC\) and joint survey work/u);
  assert.doesNotMatch(summary.summary, /foreign ministers.*Beijing/iu);

  assert.equal(summary.keyUpdates.length, 4);
  assert.equal(summary.keyUpdates.every((item) => Array.isArray(item.evidenceIds) && item.evidenceIds.length > 0), true);
  assert.equal(summary.keyUpdatesTh, undefined);
  assert.equal(summary.keyUpdatesKh, undefined);
  for (const id of ["3ae337cea857a2dea84f44523ae4b645", "5d5428fb0bf13e8e39b160558b371fc0", "7d42c3782a30a3eb11a5e2ad2b06cd70"]) {
    assert.ok(summary.summaryEvidenceIds.includes(id));
  }

  assert.ok(thailand.summaryEvidenceIds.includes("1b74fc2f24abb855829e964f656dd8b2"));
  assert.ok(thailand.summaryEvidenceIds.includes("a19b2fa33ec68f62f98b968e9ccdd798"));
  assert.ok(thailand.summaryEvidenceIds.includes("5d5428fb0bf13e8e39b160558b371fc0"));
  assert.ok(thailand.activityEvidenceIds.length > 0);
  assert.ok(cambodia.summaryEvidenceIds.includes("324ba2aec0b55f2d385bca51c6f10c7c"));
  assert.ok(cambodia.summaryEvidenceIds.includes("7d42c3782a30a3eb11a5e2ad2b06cd70"));
  assert.ok(cambodia.activityEvidenceIds.includes("1b74fc2f24abb855829e964f656dd8b2"));

  const event = timeline.find((row) => row.id === "ddf3984eecb9b92b2e21f742a9eb9ac9");
  assert.ok(event);
  assert.equal(event.date, "2026-11-14");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, ["a19b2fa33ec68f62f98b968e9ccdd798"]);
  assert.match(event.description, /Thai military allegations.*not independently verified/u);

  const conciliation = timeline.find((row) => row.id === "ks788cc52463155c9e06529fcabd461e");
  assert.equal(conciliation?.date, "2026-11-18");
  assert.equal(conciliation?.timeOfDay, undefined);
  assert.deepEqual(conciliation?.evidenceIds, ["3ae337cea857a2dea84f44523ae4b645", "5d5428fb0bf13e8e39b160558b371fc0"]);
  assert.match(conciliation.description, /scheduled;.*future outcome/u);

  const inspection = timeline.find((row) => row.id === "ks702816ab974f79eaa264691451eed0");
  assert.equal(inspection?.date, "2026-11-19");
  assert.equal(inspection?.timeOfDay, "09:20");
  assert.deepEqual(inspection?.evidenceIds, ["7d42c3782a30a3eb11a5e2ad2b06cd70"]);
  assert.match(inspection.description, /according to Cambodia's Defence Ministry/u);
  assert.doesNotMatch(inspection.descriptionKh, /การ/u);
});
