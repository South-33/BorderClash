import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Jan 10 recovery row reflects Hun Manet's funding message without fabricated program metrics", () => {
  const timeline = readJsonl("data/timeline/2026-01.jsonl");
  const news = readJsonl("data/news/2026-01.jsonl");
  const event = timeline.find((row) => row.id === "ks7dp3t69s9nwq4mg5dqv1qq4n812svc");
  const official = news.find((row) => row.id === "3c19f15db34c4f589e4fcf5cd242730f");
  const media = news.find((row) => row.id === "js794v4r6mram8fm1n1v717tmh7z20r1");

  assert.ok(event);
  assert.ok(official);
  assert.ok(media);
  assert.equal(event.date, "2026-01-10");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Funding and Reconstruction Measures/u);
  assert.match(event.description, /previously established government working group/u);
  assert.match(event.description, /implementation and funding update/u);
  assert.doesNotMatch(event.description, /25 damaged schools|25 schools/iu);
  assert.doesNotMatch(event.title, /Multi-National|Launches/iu);
  assert.deepEqual(event.evidenceIds, [
    "3c19f15db34c4f589e4fcf5cd242730f",
    "js794v4r6mram8fm1n1v717tmh7z20r1",
  ]);
  assert.match(media.summary, /January 10 special message/u);
  assert.doesNotMatch(media.summary, /25 damaged schools/iu);
  assert.equal(official.provenanceId, "hun-manet-jan10-border-recovery-message");
  assert.equal(media.provenanceId, official.provenanceId);
});
