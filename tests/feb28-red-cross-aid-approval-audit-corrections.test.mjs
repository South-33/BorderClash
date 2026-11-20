import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const id = "ks7efhh1p1jjvx6rwhrm16fgyn824kfj";

test("Red Cross aid decision is dated to February 28 with no invented exact time", () => {
  const feb = read("data/timeline/2026-02.jsonl");
  const mar = read("data/timeline/2026-03.jsonl");
  const event = feb.find((row) => row.id === id);
  assert.ok(event);
  assert.equal(event.date, "2026-02-28");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(mar.some((row) => row.id === id), false);
});

test("row records approval rather than completed March 1 distribution", () => {
  const event = read("data/timeline/2026-02.jsonl").find((row) => row.id === id);
  assert.match(event.title, /Approves Emergency Aid/u);
  assert.match(event.description, /approved emergency humanitarian assistance/u);
  assert.match(event.description, /would later distribute/u);
  assert.match(event.description, /2,880/u);
  assert.match(event.description, /heavy rainfall/u);
  assert.doesNotMatch(event.title, /Distributed/u);
});

test("Thai and Khmer copies preserve approval chronology and no exact time", () => {
  const event = read("data/timeline/2026-02.jsonl").find((row) => row.id === id);
  for (const value of [event.descriptionTh, event.descriptionKh]) {
    assert.ok(value.includes("28"));
    assert.ok(value.includes("2,880"));
    assert.ok(!value.includes("11:00"));
  }
});
