import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Emerald Triangle retrospective is anchored to the supported 2025 clash", () => {
  const id = "ks7e2x0gqj1y7sydt8aft48ep187n8vk";
  const event = readJsonl("data/timeline/2025-05.jsonl").find((row) => row.id === id);
  assert.ok(event, "corrected event should live in the May 2025 timeline file");
  assert.equal(event.date, "2025-05-28");
  assert.equal(event.timeOfDay, "05:45");
  assert.deepEqual(event.evidenceIds, [
    "5d8fe1b87d30c9eaec5f6d70ea5b2db7",
    "7b69a49e9515aec43613f905ea43b6ea",
    "a741d5d1276f2d668252f9df4ff77214",
    "a911ace2fdc97be2f5c79cccf8061497",
    "jn7d7fcdqz07jtmqaj481dwkn187j422",
  ]);
  assert.equal(readJsonl("data/timeline/2026-05.jsonl").some((row) => row.id === id), false);
});

test("December 18 humanitarian snapshot keeps Cambodia scope explicit", () => {
  const id = "ks7ayq8ftpg07hbm1ctezm4rr5812w3s";
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === id);
  assert.ok(event);
  assert.equal(event.date, "2025-12-18");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /18 Civilian Deaths/u);
  assert.match(event.title, /476,224 Displaced/u);
  assert.doesNotMatch(event.title, /60|700/u);
  assert.match(event.description, /79 injured/u);
  assert.match(event.description, /476,224 people displaced/u);
  assert.match(event.description, /cover Cambodia/u);
  assert.doesNotMatch(event.description, /Total verified fatalities|Thai side/u);
  assert.deepEqual(event.evidenceIds, [
    "3476bb82c8e4bbd1a30c6b40b26bac9c",
    "2b81f934de798d2c1547900b1f1a6de0",
  ]);
});

test("December 15 humanitarian update is not backdated to December 14", () => {
  const id = "ks701ya5evqycp609frpy3rmtd8133ss";
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === id);
  assert.ok(event);
  assert.equal(event.date, "2025-12-15");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /13 Civilian Deaths/u);
  assert.match(event.title, /1,039 Schools/u);
  assert.match(event.description, /74 injuries/u);
  assert.match(event.description, /405,758 people displaced/u);
  assert.match(event.description, /December 15/u);
  assert.match(event.description, /1,039 schools/u);
  assert.deepEqual(event.evidenceIds, ["jn7app7hzcp7j9zcgcf5f4s3h97xdszk"]);
});

test("December 21 humanitarian figures keep national definitions separate", () => {
  const id = "ks79yfakf2xfv51r79bk82ya258128kj";
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === id);
  assert.ok(event);
  assert.equal(event.date, "2025-12-21");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /34 Conflict-Linked Civilian Deaths/u);
  assert.match(event.title, /Cambodia Reports 19/u);
  assert.doesNotMatch(event.title, /53/u);
  assert.match(event.description, /33 indirect deaths/u);
  assert.match(event.description, /one civilian killed/u);
  assert.match(event.description, /19 Cambodian civilian deaths/u);
  assert.match(event.description, /518,611 people displaced/u);
  assert.match(event.description, /different definitions/u);
  assert.doesNotMatch(event.description, /controlled nearly all target areas|combined death toll of 53/u);
  assert.deepEqual(event.evidenceIds, [
    "ed1be0aef6ebee2a41b6b48c13381384",
    "35ba39019956b49538d8cff4144872e6",
  ]);
});
