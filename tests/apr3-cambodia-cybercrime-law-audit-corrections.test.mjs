import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (p) => readFileSync(p, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const id = "ks74b2fwgkk5p2tw2def26grwn845txd";
test("Apr 3 cybercrime row removes unsupported exact time and border-targeting claim", () => {
  const row = read("data/timeline/2026-04.jsonl").find((x) => x.id === id);
  assert.equal(row.date, "2026-04-03");
  assert.equal(row.timeOfDay, undefined);
  assert.match(row.title, /Parliament Passes First Law/u);
  assert.doesNotMatch(row.description, /O'Smach|Thai military allegations caused/u);
  assert.match(row.description, /does not say the law specifically targeted border towns/u);
});
test("penalties and legislative status match captured Reuters reproduction", () => {
  const row = read("data/timeline/2026-04.jsonl").find((x) => x.id === id);
  assert.match(row.description, /two to five years/u);
  assert.match(row.description, /as much as 10 years/u);
  assert.match(row.description, /King's signature/u);
  assert.deepEqual(row.evidenceIds, ["3abcab9552ad16d5a69b7a5ee466b512"]);
});
test("Thai and Khmer copies preserve scope and uncertainty", () => {
  const row = read("data/timeline/2026-04.jsonl").find((x) => x.id === id);
  for (const value of [row.descriptionTh, row.descriptionKh]) {
    assert.ok(value.includes("2-5"));
    assert.ok(value.includes("10"));
  }
});
