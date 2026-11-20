import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Jun 18 detention follows the captured Navy report", () => {
  const rows = readFileSync("data/timeline/2026-06.jsonl", "utf8")
    .trim()
    .split(/\r?\n/u)
    .map(JSON.parse);
  const event = rows.find((item) => item.id === "ks7a2ws260fm8nxpj15sqm61wd88z2xa");

  assert.equal(event.date, "2026-06-18");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, ["js73q6yb67vp92e4z44eqaweed88zned"]);
  assert.match(event.description, /around 04:00/u);
  assert.match(event.description, /27 men, 17 women and six children/u);
  assert.match(event.description, /10 men acting as paid porters and guides/u);
  assert.match(event.description, /return to Cambodia/u);
  assert.doesNotMatch(event.title + " " + event.description, /50 Cambodian nationals|100% border closure/u);
});
