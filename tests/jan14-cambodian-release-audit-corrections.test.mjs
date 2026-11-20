import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const id = "ks7cdpfgjj6j7whm66v0a7vkh9812kp0";
const rows = readFileSync("data/timeline/2026-01.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse);
const row = rows.find((item) => item.id === id);

test("Jan 14 release keeps the publisher-supported afternoon precision", () => {
  assert.ok(row);
  assert.equal(row.date, "2026-01-14");
  assert.equal(row.timeOfDay, undefined);
  assert.deepEqual(row.evidenceIds, ["jn76xctc1r5zv7ze9ms8y3y8ah7z8vzk"]);
  assert.match(row.title, /Khmer Times Reports/u);
  assert.match(row.description, /afternoon of January 14/u);
  assert.match(row.description, /08:00 on January 13/u);
  assert.match(row.description, /temporary Prasat Tbeng checkpoint/u);
  assert.match(row.descriptionTh, /ช่วงบ่ายวันที่ 14 มกราคม/u);
  assert.match(row.descriptionKh, /រសៀលថ្ងៃទី 14 ខែមករា/u);
});
