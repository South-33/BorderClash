import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Dec 21 displacement milestone does not fabricate a synchronized bilateral total", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const news = readJsonl("data/news/2025-12.jsonl");
  const event = timeline.find((row) => row.id === "ks78cet0tp1r96n6t2pqstx3fd812v42");
  assert.ok(event);
  assert.equal(event.date, "2025-12-21");
  assert.match(event.description, /07:00 on December 21/u);
  assert.match(event.description, /518,611/u);
  assert.match(event.description, /213,072 people in 889 shelters/u);
  assert.match(event.description, /different measures and reference points/u);
  assert.match(event.description, /does not add them/u);
  assert.doesNotMatch(event.description, /roughly 919,000|22 deaths|19 in Cambodia/iu);
  assert.deepEqual(event.evidenceIds, [
    "35ba39019956b49538d8cff4144872e6",
    "k972xnkn02ddn37wh6504ec5g17xqpg0",
    "ed1be0aef6ebee2a41b6b48c13381384",
  ]);
  for (const id of [
    "k972xnkn02ddn37wh6504ec5g17xqpg0",
    "k9750ne965fe86070vtq4nde817xqgg4",
    "k978nvgg19nbkyhthjzwbebt1n7xrk0c",
  ]) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, "afp-dec21-cambodia-displacement");
  }
});
