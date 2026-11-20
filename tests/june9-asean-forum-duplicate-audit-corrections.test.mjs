import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("June 9 ASEAN Future Forum meeting keeps the earlier stable ID and removes the duplicate", () => {
  const rows = readJsonl("data/timeline/2026-06.jsonl");
  const event = rows.find((row) => row.id === "ks7bjh5t79dvbatw0j28z90ymh88chxx");
  assert.ok(event);
  assert.equal(event.date, "2026-06-09");
  assert.equal(event.timeOfDay, "");
  assert.equal(event.importance, 80);
  assert.deepEqual(event.evidenceIds, ["jn7bxrk91vabsrcekqe4h4c09988dtvv"]);
  assert.match(event.description, /informal discussion/u);
  assert.match(event.description, /details of the discussion were not released/u);
  assert.doesNotMatch(event.description, /formally committed/u);
  assert.equal(rows.some((row) => row.id === "ks7d6rfe192hhwfy5xe7gdfg5988d344"), false);
});

test("June 9 ASEAN Forum copy remains aligned across all three languages", () => {
  const event = readJsonl("data/timeline/2026-06.jsonl")
    .find((row) => row.id === "ks7bjh5t79dvbatw0j28z90ymh88chxx");
  assert.match(event.description, /Anutin Charnvirakul/u);
  assert.match(event.description, /Hun Manet/u);
  assert.match(event.descriptionTh, /อนุทิน/u);
  assert.match(event.descriptionTh, /ฮุน มาเนต/u);
  assert.match(event.descriptionKh, /ហ៊ុន ម៉ាណែត/u);
});
