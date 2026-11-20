import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const id = "ks71e182srtw37n5g7e3xw9k81812we9";

function timelineRows() {
  return readdirSync("data/timeline")
    .filter((name) => name.endsWith(".jsonl"))
    .flatMap((name) => readFileSync(`data/timeline/${name}`, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse));
}

test("Khao Phra Wihan park damage report uses the publisher's Dec 29 chronology", () => {
  const matches = timelineRows().filter((item) => item.id === id);
  assert.equal(matches.length, 1);
  const [event] = matches;
  assert.equal(event.date, "2025-12-29");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, ["js74c53y719j2x6mcdn4p56kks7yd0gv"]);
  assert.match(event.title, /^Khao Phra Wihan National Park Reports/u);
  assert.match(event.description, /40 BM-20 rounds/u);
  assert.match(event.description, /still being surveyed/u);
  assert.match(event.description, /did not say clearance teams had already been deployed/u);
  assert.doesNotMatch(event.description, /post-conflict survey/u);
  assert.match(event.descriptionTh, /วันที่ 29 ธันวาคม/u);
  assert.match(event.descriptionKh, /ថ្ងៃទី 29 ខែធ្នូ/u);
});
