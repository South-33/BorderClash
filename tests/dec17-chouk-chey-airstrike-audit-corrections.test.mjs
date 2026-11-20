import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7bp9mzd9kqjkm3bf9hgzc085812v08";
const evidenceId = "2cd692ad38f3b4cdfbf1397dfb474022";
const rows = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("Dec 17 06:25 F-16 row uses Chouk Chey rather than Prey Chan", () => {
  assert.equal(event.date, "2025-12-17");
  assert.equal(event.timeOfDay, "06:25");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.title, /Chouk Chey at 06:25/u);
  assert.match(event.description, /bombarded Chouk Chey village/u);
  assert.match(event.description, /later attempted to infiltrate Chouk Chey and Prey Chan villages/u);
  assert.match(event.description, /does not independently establish responsibility/u);
  assert.match(event.description, /previous timeline wording incorrectly placed the 06:25 bombing at Prey Chan/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
