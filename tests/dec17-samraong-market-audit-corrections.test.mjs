import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks77amrwpdqe5w3c5ryezq002s813prd";
const rows = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("Dec 17 Samraong row uses the reported 20:00 incident time, not the 20:40 update time", () => {
  assert.equal(event.date, "2025-12-17");
  assert.equal(event.timeOfDay, "20:00");
  assert.match(event.title, /^Khmer Times Reports/u);
  assert.match(event.description, /one person had died and at least two people were injured/u);
  assert.match(event.description, /does not independently establish responsibility/u);
  assert.match(event.description, /20:40 shown in the article headline is the update time/u);
  assert.doesNotMatch(event.description, /major fire/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
