import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rows = () => readFileSync("data/timeline/2026-04.jsonl", "utf8")
  .trim().split(String.fromCharCode(10)).map(JSON.parse);

test("Apr 9 Army shelter update has one canonical timeline record", () => {
  const timeline = rows();
  assert.equal(timeline.some((row) => row.id === "ks7e7m3jqz9q5edjxpawkebzes84g4fk"), false);
  const survivor = timeline.find((row) => row.id === "ks703xvv09kbd8jp3qacqkh9h184jj9w");
  assert.ok(survivor);
  assert.equal(survivor.date, "2026-04-09");
  assert.equal(survivor.timeOfDay, undefined);
  assert.deepEqual(survivor.evidenceIds, ["be26158f63b67e7b2ea51146ed3a7f5b"]);
  assert.match(survivor.description, /117 of 182 planned shelters/u);
  assert.match(survivor.description, /65 were still under construction/u);
});
