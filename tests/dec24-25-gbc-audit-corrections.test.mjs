import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Dec 24 GBC event records the first day without the Dec 25 letter dispute", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const event = timeline.find((row) => row.id === "ks7c6zg542k5tfjpwd841dss1n813egj");

  assert.ok(event);
  assert.equal(event.date, "2025-12-24");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(event.title, "GBC Secretariat Talks Begin in Chanthaburi");
  assert.match(event.description, /began talks in Chanthaburi/u);
  assert.match(event.description, /three stated conditions/u);
  assert.match(event.description, /conditional on progress at the secretariat level/u);
  assert.doesNotMatch(event.description, /second day|Tea Seiha|fake news|request letter/iu);
  assert.deepEqual(event.evidenceIds, [
    "jn74x0g2tsdnjc716phd2snrax7xx6jv",
    "k97faqgtdd3nhxy9rn5xexqmv97xyy7a",
    "k97d7ws46dytwdn05m3c3pdjwx7y16v0",
  ]);
});

test("Dec 25 GBC event uses direct second-day evidence and keeps the supported 09:05 start", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const event = timeline.find((row) => row.id === "ks72v9f12nqx7mra1377k8ez018120rb");

  assert.ok(event);
  assert.equal(event.date, "2025-12-25");
  assert.equal(event.timeOfDay, "09:05");
  assert.equal(event.title, "GBC Secretariat Talks Enter Second Day");
  assert.match(event.description, /session began at 09:05/u);
  assert.match(event.description, /technical discussions/u);
  assert.doesNotMatch(event.description, /near(?:ly)? derailed|AI translation|fake news|formal ceasefire request/iu);
  assert.deepEqual(event.evidenceIds, [
    "jn76rex247jj7pzwdkpkcfrzwx7xybgn",
    "k972zwn5fwe326p6q32m19jhks7xzpkt",
  ]);
});
