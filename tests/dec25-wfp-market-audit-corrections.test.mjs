import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks77z74hdjc8sy349ebhxnk89x812wns";
const row = () => readFileSync("data/timeline/2025-12.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse).find((item) => item.id === id);

test("Dec 25 WFP market milestone follows captured December findings", () => {
  const event = row();
  assert.equal(event.date, "2025-12-25");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /seven markets had closed/u);
  assert.match(event.description, /KHR 98,928/u);
  assert.match(event.description, /6\.8% (?:below|from) November/u);
  assert.match(event.description, /continued or expanded clashes/u);
  assert.doesNotMatch(event.description, /a million displaced|now at high risk/u);
});
