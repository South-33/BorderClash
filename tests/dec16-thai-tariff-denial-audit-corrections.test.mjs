import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8")
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test("Dec 16 tariff reaction keeps Thailand's account, removes wrong actor and unsupported time", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const event = timeline.find((row) => row.id === "ks7bjw7s79n0ercjhp6bs1rp8h813gt7");
  assert.ok(event);
  assert.equal(event.date, "2025-12-16");
  assert.equal(event.timeOfDay, undefined);
  assert.doesNotMatch(event.description, /Pichai Naripthaphan/u);
  assert.match(event.description, /Thailand's commerce minister/u);
  assert.match(event.description, /This records Thailand's account/u);
  assert.match(event.description, /Wall Street Journal/u);
  assert.deepEqual(event.evidenceIds, ["k97ek2z6jhkbc2prjh3ffx6t797xdmg7"]);
});

test("Thai and English versions of the Dec 16 Thairath roundup share provenance", () => {
  const news = readJsonl("data/news/2025-12.jsonl");
  const thai = news.find((row) => row.id === "js7f94y3q5x162bfh4wg9y11bh7xck23");
  const english = news.find((row) => row.id === "k97ek2z6jhkbc2prjh3ffx6t797xdmg7");
  assert.ok(thai);
  assert.ok(english);
  assert.equal(thai.provenanceId, "thairath-international-reactions-dec16");
  assert.equal(english.provenanceId, "thairath-international-reactions-dec16");
  assert.match(english.summary, /commerce minister/u);
  assert.match(english.summary, /conflicting/u);
});
