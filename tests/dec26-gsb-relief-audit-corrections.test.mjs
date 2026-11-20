import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Dec 26 GSB relief milestone keeps the announcement date and removes unsupported exact time", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const event = timeline.find((row) => row.id === "ks752hmd1hs54a0v7rch42d1ms812fc6");

  assert.ok(event);
  assert.equal(event.date, "2025-12-26");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /On December 26/u);
  assert.match(event.description, /from December 7 onward/u);
  assert.match(event.description, /three-payment principal moratorium/u);
  assert.match(event.description, /waiving interest/u);
  assert.doesNotMatch(event.description, /all civilians|all displaced/iu);
});
