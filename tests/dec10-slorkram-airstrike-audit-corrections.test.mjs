import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks774yhtfwmph007a581675tds8120kb";
const evidenceId = "fd5429e6d115aa884496953f629bfa5a";
const rows = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("Dec 10 Slor Kram row uses the official 09:50 two-bomb report and keeps attribution", () => {
  assert.equal(event.date, "2025-12-10");
  assert.equal(event.timeOfDay, "09:50");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.description, /dropped two bombs on Slor Kram village/u);
  assert.match(event.description, /Cambodia's official position/u);
  assert.match(event.description, /not independently established/u);
  assert.doesNotMatch(event.description, /targeted civilian-populated areas rather than military positions/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
