import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks73zs69sdy0bf59qdn25z1pcd813hjv";
const rows = readFileSync("data/timeline/2026-02.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("Feb 2 RBC row stays within the captured Cambodian report", () => {
  assert.equal(event.date, "2026-02-02");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, ["jn75kr312kwv7g1ejenezq3qqs80dfg5"]);
  assert.match(event.description, /had not yet found a common position/u);
  assert.match(event.description, /continue exchanging documents and discussions/u);
  assert.match(event.description, /six-point summary remains access-blocked/u);
  assert.doesNotMatch(event.description, /monthly meetings|mine warnings/u);
  assert.match(event.descriptionTh, /ยังหาจุดร่วมไม่ได้/u);
  assert.match(event.descriptionKh, /មិនទាន់រកឃើញចំណុចរួម/u);
});
