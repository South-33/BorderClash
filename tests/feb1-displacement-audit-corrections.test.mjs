import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Feb 1 displacement snapshot uses the source's 06:00 cutoff and reported counts", () => {
  const timeline = readJsonl("data/timeline/2026-02.jsonl");
  const event = timeline.find((row) => row.id === "ks72q4mnp747hrs60v8gsc0cs58120a2");

  assert.ok(event);
  assert.equal(event.date, "2026-02-01");
  assert.equal(event.timeOfDay, "06:00");
  assert.match(event.title, /111,509/u);
  assert.match(event.description, /753 more displaced people had returned/u);
  assert.match(event.description, /83% of more than 640,000/u);
  assert.match(event.description, /111,509 remained/u);
  assert.match(event.description, /58,448 women/u);
  assert.match(event.description, /36,494 children/u);
  assert.match(event.description, /no exchange of fire since the December 27 ceasefire/u);
});
