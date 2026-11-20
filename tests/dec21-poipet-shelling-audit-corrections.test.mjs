import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7935rzqsehacvark1mt92r3x813m7b";
const evidenceId = "jn7c6sm1kgcv9973pq6x6gb6rx7xptqq";
const rows = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("Dec 21 Poipet row separates the 13:35, 14:00 and 15:00 reported shelling updates", () => {
  assert.equal(event.date, "2025-12-21");
  assert.equal(event.timeOfDay, "13:35");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.description, /13:35.*nine large-calibre artillery shells/u);
  assert.match(event.description, /14:00.*outskirts of Poipet/u);
  assert.match(event.description, /15:00.*Ta Moan Temple/u);
  assert.match(event.description, /does not independently verify responsibility/u);
  assert.doesNotMatch(event.description, /at least 11 artillery shells/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
