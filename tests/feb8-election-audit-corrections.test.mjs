import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks73ktxbtea6jkk6ea5npc4y1x813nca";
const evidenceId = "k97dgrck89kckn2nbd92yv0css80xkps";
const rows = readFileSync("data/timeline/2026-02.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("Feb 8 election row keeps Reuters' multi-factor analysis and preliminary result framing", () => {
  assert.equal(event.date, "2026-02-08");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.title, /Clear Victory/u);
  assert.match(event.description, /about 192 seats/u);
  assert.match(event.description, /embrace of nationalism as critical/u);
  assert.match(event.description, /politicians from rival parties in rural areas/u);
  assert.match(event.description, /unlikely to win an outright majority/u);
  assert.doesNotMatch(event.description, /Analysts credit the landslide to a surge in nationalist sentiment/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
