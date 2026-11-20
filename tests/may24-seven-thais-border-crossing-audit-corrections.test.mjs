import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks704hnyz5sq4g9ak0c4qhwnp187a1v1";
const evidenceId = "fd63ed46a77753370e96ff01ca8e6359";
const row = () => readFileSync("data/timeline/2026-05.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse).find((r) => r.id === id);

test("May 24 seven-Thais crossing row uses captured 06:00 Navy account", () => {
  const event = row();
  assert.ok(event);
  assert.equal(event.date, "2026-05-24");
  assert.equal(event.timeOfDay, "06:00");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.description, /seven Thai nationals/u);
  assert.match(event.description, /Cambodian broker/u);
});
