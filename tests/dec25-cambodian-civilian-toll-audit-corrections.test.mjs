import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks74mmja93r901dc26281r3g35812ajt";
const row = () => readFileSync("data/timeline/2025-12.jsonl", "utf8")
  .trim()
  .split(/\r?\n/u)
  .map(JSON.parse)
  .find((record) => record.id === id);

test("Dec 25 civilian toll preserves differing contemporaneous official counts", () => {
  const event = row();
  assert.equal(event.date, "2025-12-25");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /30 or 31/u);
  assert.match(event.description, /bringing the total to 30/u);
  assert.match(event.description, /31 Cambodian civilians/u);
});

test("Dec 25 civilian toll avoids invented sequencing and audit commentary", () => {
  const event = row();
  assert.match(event.description, /different official Cambodian civilian death totals/u);
  assert.doesNotMatch(event.description, /later reached|previous 21:00|supports the previous/u);
  assert.match(event.description, /do not explain why the official totals differed/u);
});
