import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7ckm0r4shb7hebj1g2q7dfws8125nr";
const rows = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("Dec 14 toxic-smoke row uses the reported 16:00 incident time and explicit attribution", () => {
  assert.equal(event.date, "2025-12-14");
  assert.equal(event.timeOfDay, "16:00");
  assert.equal(event.status, "unverified");
  assert.match(event.title, /^Khmer Times Reports Alleged/u);
  assert.match(event.description, /at about 16:00/u);
  assert.match(event.description, /does not independently establish the substance used/u);
  assert.doesNotMatch(event.description, /17:00 shown in the article headline|captured publisher text/u);
  assert.doesNotMatch(event.description, /growing list of unconventional warfare allegations/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
