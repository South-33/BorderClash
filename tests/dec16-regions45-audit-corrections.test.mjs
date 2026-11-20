import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7cqqp77snfb6syr8w90r8zyd812c52";
const evidenceId = "jn71p32npq94gpmknzck2sv2m57xcrzh";
const rows = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("Dec 16 Regions 4/5 summary removes unsupported An Ses and single exact time", () => {
  assert.equal(event.date, "2025-12-16");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.title, /Military Regions 4 and 5/u);
  assert.match(event.description, /Ghost Mountain.*07:20/u);
  assert.match(event.description, /from 18:00 on December 15 to 08:00 on December 16/u);
  assert.match(event.description, /Cambodia's Ministry of National Defence reported/u);
  assert.doesNotMatch(event.description, /An Ses/u);
  assert.doesNotMatch(event.title, /Ghost Mountain and An Ses/u);
  assert.doesNotMatch(event.description, /10th day of invasion/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /ï¿½/u);
});
