import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const impact = JSON.parse(readFileSync("data/current/impact.json", "utf8"));

test("current impact metrics use canonical evidence instead of raw source URLs", () => {
  assert.equal(Object.hasOwn(impact.displaced, "sourceUrl"), false);
  assert.equal(Object.hasOwn(impact.deaths, "sourceUrl"), false);
  assert.deepEqual(impact.displaced.evidenceIds, ["3799c455fb54e43d6d2e17ef066d8fc9"]);
  assert.deepEqual(impact.deaths.evidenceIds, ["1680d2fad2725b798f4f04bd51cf29db"]);
  assert.match(impact.displaced.scope, /Cambodian residents/u);
  assert.match(impact.deaths.scope, /2025 border fighting/u);
});
