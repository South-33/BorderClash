import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks70vfgxegr8cgynwvb7g01czh813mr2";
const rows = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("Dec 23 shelling row distinguishes the update label from event times", () => {
  assert.equal(event.date, "2025-12-23");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /at 10:39/u);
  assert.match(event.description, /from midnight until 11:00/u);
  assert.match(event.description, /as of 12:50/u);
  assert.match(event.description, /13:00 label is an update time/u);
  assert.match(event.description, /not independently verified/u);
  assert.doesNotMatch(event.description, /simultaneous shelling|high alert despite upcoming talks/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
