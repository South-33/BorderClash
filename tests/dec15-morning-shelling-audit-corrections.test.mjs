import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks73da5ctr0b92ekzrxesj2235812123";
const evidenceId = "jn72ysramt7qse5vqqcdtv6b457xb5c2";
const rows = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("Dec 15 row is narrowed to the captured Cambodian morning account", () => {
  assert.equal(event.date, "2025-12-15");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.title, /Cambodian Account of Dec 15 Morning Shelling/u);
  assert.match(event.description, /04:00 to 09:18/u);
  assert.match(event.description, /155mm artillery/u);
  assert.match(event.description, /not independently established/u);
  assert.doesNotMatch(event.description, /505 Cambodian soldiers|12 tanks destroyed|stalemate/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
