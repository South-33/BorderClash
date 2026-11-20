import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks79wwa9dwrsxx306s5vbnap7h813n29";
const evidenceIds = ["jn75gvh66neyayc0mdk5r9ckp17xweb7", "jn7b0xs8gcawhkemw3vggte2zn7xwszv"];
const rows = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("Dec 24 row follows the two captured Khmer Times updates without false exact precision", () => {
  assert.equal(event.date, "2025-12-24");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, evidenceIds);
  assert.match(event.description, /as of 07:30/u);
  assert.match(event.description, /around 05:00/u);
  assert.match(event.description, /between 12:15 and 12:26/u);
  assert.match(event.description, /at 14:02/u);
  assert.match(event.description, /not independently verified/u);
  assert.doesNotMatch(event.description, /despite opening of peace talks|midnight near Preah Vihear/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
