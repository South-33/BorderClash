import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Feb 24 grenade dispute is one attributed milestone without duplicate skirmish rows", () => {
  const timeline = readJsonl("data/timeline/2026-02.jsonl");
  const news = readJsonl("data/news/2026-02.jsonl");
  const event = timeline.find((row) => row.id === "ks7dh0rx63mhzmsj90jad2719581vmn2");
  assert.ok(event);
  assert.equal(event.date, "2026-02-24");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Thailand Reports 40-mm Grenade Fire/u);
  assert.match(event.description, /at about 08:50/u);
  assert.match(event.description, /Cambodia's Defence Ministry categorically denied/u);
  assert.match(event.description, /Responsibility for the initial fire remains disputed/u);
  assert.doesNotMatch(event.description, /first significant|first ceasefire breach/iu);
  assert.deepEqual(event.evidenceIds, [
    "c18924f53142b4c906b03bdd7e3a9c13",
    "jn77b45fm4077m0vbbkmxqy1gn81vdyb",
    "k977q2f60fbaxny5z9ntzszx5d81v1en",
  ]);
  for (const id of [
    "ks74kg15k66eqjjgksvy8q790n81zxg9",
    "ks797dj7zevc4yeh86krpn5zyx81w96m",
    "ks7cbtn5sh7z2r32sy7j7x67g9840q3c",
  ]) {
    assert.equal(timeline.some((row) => row.id === id), false);
  }
  for (const id of [
    "jn77b45fm4077m0vbbkmxqy1gn81vdyb",
    "jn7e0n73qmvfevxteazgw2rr2n81zwte",
    "jn78qhqr3kg4gt4q11cbnvb0a181x55r",
    "jn7f8466fh8r8dya6zg3aw6nwh81vrdk",
  ]) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, "cambodia-mod-feb24-grenade-denial");
  }
});

test("March 11 row carries the later Thai survey-safety position instead of backdating it to Feb 24", () => {
  const timeline = readJsonl("data/timeline/2026-03.jsonl");
  const event = timeline.find((row) => row.id === "ks76qc27csqyr01z6razk7xvwh82pjw0");
  assert.ok(event);
  assert.equal(event.date, "2026-03-11");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Defers JBC Response Pending New Cabinet/u);
  assert.match(event.description, /technical survey and demarcation work/u);
  assert.match(event.description, /February 24 grenade incident/u);
  assert.match(event.description, /Cambodia disputes responsibility/u);
  assert.deepEqual(event.evidenceIds, [
    "js7e8fk26trj0r5a8nbqfv63fs840jbh",
    "jn72z2br821v6ab4ywahd8e1hs82q8yf",
  ]);
});
