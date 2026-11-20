import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7cf9sxm4r5t51mqrak8r8xfn89vz59";
const evidenceId = "1090f03ea42ee43d3fa4b85436995584";
const row = () => readFileSync("data/timeline/2026-07.jsonl", "utf8")
  .trim()
  .split(/\r?\n/u)
  .map(JSON.parse)
  .find((record) => record.id === id);

test("Jul 2 AOT-TH Trat inspection is grounded in captured reporting", () => {
  const event = row();
  assert.ok(event);
  assert.equal(event.date, "2026-07-02");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.description, /boundary marker 73/u);
  assert.match(event.description, /no exact event time/u);
});

test("Jul 2 Trat row removes the unrelated Buri Ram allegation", () => {
  const event = row();
  assert.doesNotMatch(event.description, /Thai encroachment in Buri Ram/u);
  assert.doesNotMatch(event.description, /Buri Ram/u);
});
