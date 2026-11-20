import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks74k9556tbt9vf5s5shrwygj9812kx4";
const row = () => readFileSync("data/timeline/2025-12.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse).find((item) => item.id === id);

test("Dec 15 First Army summary uses captured Thai PBS time and attribution", () => {
  const event = row();
  assert.equal(event.date, "2025-12-15");
  assert.equal(event.timeOfDay, "18:00");
  assert.deepEqual(event.evidenceIds, ["ead8aab9a8d6908ee4c57d905e801fd1"]);
  assert.match(event.description, /139 Cambodian nationals/u);
  assert.match(event.description, /BM-21 rockets, artillery and mortars/u);
  assert.match(event.description, /attributed to the Thai First Army Region/u);
});
