import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7e2n22b8yf7q47n746x77s3d812ftj";
const row = () => readFileSync("data/timeline/2025-12.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse).find((item) => item.id === id);

test("Dec 14 Thai MFA crossing position is grounded in captured replacement evidence", () => {
  const event = row();
  assert.equal(event.date, "2025-12-14");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, ["77015e82108d81093a4f4c7376b15c0c"]);
  assert.match(event.title, /Four-Point Position/u);
  assert.match(event.description, /Thai citizens in Cambodia were unable to return/u);
  assert.match(event.description, /safety and dignity of civilians/u);
  assert.match(event.description, /said Thailand's actions were for self-defense/u);
});
