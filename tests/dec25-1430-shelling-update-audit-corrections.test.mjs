import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks76e9d7h4bms86vqdvvesmbmx812t3t";
const evidenceId = "jn757cf77n2nkdnqc0ztbj3vcx7xycn9";
const rows = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("Dec 25 14:30 row is narrowed to the captured Cambodian battlefield update", () => {
  assert.equal(event.date, "2025-12-25");
  assert.equal(event.timeOfDay, "14:30");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.title, /as of 14:30/u);
  assert.match(event.description, /from 13:50 to 14:19/u);
  assert.match(event.description, /not independently verified/u);
  assert.match(event.description, /status cutoff explicitly stated/u);
  assert.doesNotMatch(event.description, /DTI-2|civil society|immediate ceasefire|tanks moved/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
