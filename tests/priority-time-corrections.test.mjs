import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path) { return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse); }
function findEvent(path, id) { return readJsonl(path).find((row) => row.id === id); }

test("December 25 casualty aggregate stays date-only and labels mixed categories", () => {
  const event = findEvent("data/timeline/2025-12.jsonl", "ks7aeb3xa6hahx4hmkaybmef3h813nts");
  assert.ok(event);
  assert.equal(event.date, "2025-12-25");
  assert.equal(Object.hasOwn(event, "timeOfDay"), false);
  assert.match(event.title, /Media Aggregate/u);
  assert.match(event.description, /96/u);
  assert.match(event.description, /mixed|different categories/u);
  assert.match(event.description, /23 soldiers/u);
  assert.match(event.description, /31 civilian deaths/u);
});

test("February 8 Bhumjaithai result is a clear victory, not an unsupported landslide or majority", () => {
  const event = findEvent("data/timeline/2026-02.jsonl", "ks73ktxbtea6jkk6ea5npc4y1x813nca");
  assert.ok(event);
  assert.equal(event.date, "2026-02-08");
  assert.equal(Object.hasOwn(event, "timeOfDay"), false);
  assert.match(event.title, /Clear Victory/u);
  assert.match(event.description, /about 192 seats/u);
  assert.match(event.description, /unlikely to win an outright majority/u);
});

test("June 2 UNCLOS launch is the formal compulsory-conciliation notice", () => {
  const event = findEvent("data/timeline/2026-06.jsonl", "ks7ffpj44tarr5s6713ptwaxrn87zmxr");
  assert.ok(event);
  assert.equal(event.date, "2026-06-02");
  assert.equal(Object.hasOwn(event, "timeOfDay"), false);
  assert.match(event.title, /Compulsory Conciliation Notice/u);
  assert.match(event.description, /formal notice to Thailand and the UN Secretary-General/u);
  assert.match(event.description, /21 days/u);
});

test("Trump ceasefire milestone keeps the competing claim, Thai rejection, and current captured evidence", () => {
  const event = findEvent("data/timeline/2025-12.jsonl", "ks77b6xg32zh9gt6f04d5mecqh813b3s");
  assert.ok(event);
  assert.equal(event.date, "2025-12-13");
  assert.equal(Object.hasOwn(event, "timeOfDay"), false);
  assert.match(event.description, /agreed to cease shooting/u);
  assert.match(event.description, /had not agreed to a ceasefire/u);
  assert.match(event.description, /Fighting continued/u);
  assert.deepEqual(event.evidenceIds, ["k97bf52b4tctfzm3jggwbgcbs17x85q6", "js75x4f283x8eqa48zrfqx31757x7yae", "js7175kg3r97ms3hdgxaqfnrph7x86kd", "jn774n9wymtk33rd1g5fbg5qys7xaybk"]);
});

test("December 21 displacement snapshot does not synthesize incompatible cross-border totals", () => {
  const event = findEvent("data/timeline/2025-12.jsonl", "ks78cet0tp1r96n6t2pqstx3fd812v42");
  assert.ok(event);
  assert.equal(event.date, "2025-12-21");
  assert.equal(Object.hasOwn(event, "timeOfDay"), false);
  assert.match(event.title, /518,611/u);
  assert.match(event.description, /07:00/u);
  assert.match(event.description, /around 400,000/u);
  assert.match(event.description, /213,072/u);
  assert.doesNotMatch(event.description, /919,000|nearly one million/iu);
});

test("O'Smach media tour keeps observed counts separate from attributed Thai military claims", () => {
  const event = findEvent("data/timeline/2026-04.jsonl", "ks76wk6d4eb8be65pdvq1ghdj584hr09");
  assert.ok(event);
  assert.equal(event.date, "2026-04-07");
  assert.equal(Object.hasOwn(event, "timeOfDay"), false);
  assert.match(event.description, /157 buildings/u);
  assert.match(event.description, /29 used for scam businesses/u);
  assert.match(event.description, /Thai officials' claims/u);
  assert.match(event.description, /military outpost and drone launch site/u);
  assert.doesNotMatch(event.description, /Cambodia has protested/u);
});