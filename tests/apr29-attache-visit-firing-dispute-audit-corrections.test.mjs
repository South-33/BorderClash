import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks76f02nfqzk5m7xj71yhjzr8185v3ss";
const evidenceId = "js710sp3jy6zw96ghedgst83ws85vs3c";
const rows = readFileSync("data/timeline/2026-04.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("April 29 attaché-visit row preserves the approximate incident window without inventing an exact time", () => {
  assert.equal(event.date, "2026-04-29");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.description, /five occasions between about 10:35 and 11:09/u);
  assert.match(event.description, /lit three firecrackers as a warning/u);
  assert.match(event.description, /competing official accounts/u);
  assert.doesNotMatch(event.description, /timeline time marks the start/u);
  assert.doesNotMatch(event.description, /nine times|nine rounds/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
