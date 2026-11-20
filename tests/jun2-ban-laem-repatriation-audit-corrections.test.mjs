import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7am1mhhddtz8d4c33rywan0587wmmd";
const row = () => readFileSync("data/timeline/2026-06.jsonl", "utf8")
  .trim().split(String.fromCharCode(10)).map(JSON.parse).find((item) => item.id === id);

test("June 2 Ban Laem record reflects the announced afternoon return", () => {
  const event = row();
  assert.equal(event.date, "2026-06-02");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, ["7cc0ac7ca50c3cd825d1fddd8d97cc55"]);
  assert.match(event.title, /Announces June 2 Return of 47 Cambodians/u);
  assert.match(event.description, /would facilitate an Immigration Bureau operation that afternoon/u);
  assert.match(event.description, /not a reopening or relaxation of border controls/u);
  assert.doesNotMatch(event.description, /completed the legal repatriation/u);
});
