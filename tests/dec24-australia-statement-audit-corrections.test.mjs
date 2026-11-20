import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7e8rancswt9p3t0m45yv3zs1813pst";
const rows = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("Dec 24 Australia statement uses DFAT wording and no invented exact time", () => {
  assert.equal(event.date, "2025-12-24");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /^Australia Expresses Deep Concern/u);
  assert.doesNotMatch(event.title, /Condemns/u);
  assert.match(event.description, /heavy destructive weapons/u);
  assert.match(event.description, /ASEAN, Malaysia and the United States/u);
  assert.match(event.description, /no exact event time/u);
  assert.doesNotMatch(event.description, /10:00/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
