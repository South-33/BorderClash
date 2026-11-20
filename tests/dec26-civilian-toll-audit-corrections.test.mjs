import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7amez7sgt23ca1212amb9r8s813n87";
const rows = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("Dec 26 civilian toll keeps the publisher-supported 18:00 cutoff and attributes responsibility", () => {
  assert.equal(event.date, "2025-12-26");
  assert.equal(event.timeOfDay, "18:00");
  assert.match(event.title, /^Cambodian Interior Ministry Reports/u);
  assert.match(event.description, /from 13:00 to 18:00/u);
  assert.match(event.description, /31 deaths and 91 injuries/u);
  assert.match(event.description, /Cambodia's stated position/u);
  assert.match(event.description, /not independently established/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
