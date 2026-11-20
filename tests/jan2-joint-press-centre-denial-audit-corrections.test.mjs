import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks70a9cec21h78j3nq3qhj5amx813sfc";
const evidenceId = "js768ab8na4g39efe37sd6v1m17yea40";
const rows = readFileSync("data/timeline/2026-01.jsonl", "utf8")
  .trim()
  .split(/\r?\n/u)
  .map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("Jan 2 denial stays attributed and drops unsupported exact time", () => {
  assert.equal(event.date, "2026-01-02");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.title, /Joint Press Centre Denies/u);
  assert.match(event.description, /Thailand's stated position/u);
  assert.match(event.description, /does not independently establish/u);
  assert.match(event.description, /no exact event time/u);
  assert.doesNotMatch(event.description, /14:00/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
