import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const id = "ks7fa1wfmm8f0k613kpk1qkbs1813n4d";
const rows = () => readFileSync("data/timeline/2025-12.jsonl","utf8").trim().split(/\r?\n/u).map(JSON.parse);
test("Dec 13 arms-depot row treats 18:00 as report time, not strike time", () => {
  const e = rows().find((r) => r.id === id);
  assert.ok(e);
  assert.equal(e.timeOfDay, undefined);
  assert.match(e.description, /situation summary.*18:00/u);
  assert.match(e.description, /not an exact strike time/u);
});
test("Dec 13 arms-depot row keeps the Thai Army claim attributed and specific", () => {
  const e = rows().find((r) => r.id === id);
  assert.match(e.description, /Naewna reported/u);
  assert.match(e.description, /(arms|weapons) and ammunition depot/u);
  assert.match(e.description, /air-defen[cs]e communications/u);
  assert.match(e.description, /Thai military claims/u);
});
