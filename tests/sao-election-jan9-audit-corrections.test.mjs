import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Jan 9 SAO election reschedule keeps the EC's exact scope and rationale", () => {
  const timeline = readJsonl("data/timeline/2026-01.jsonl");
  const event = timeline.find((row) => row.id === "ks7a2bgg04je4s3b2v7r1vfwfd813jrp");
  const news = readJsonl("data/news/2026-01.jsonl");

  assert.ok(event);
  assert.equal(event.date, "2026-01-09");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /15 Kantharalak SAO Elections/u);
  assert.match(event.description, /Kantharalak district, Si Sa Ket province/u);
  assert.match(event.description, /January 11 to January 18/u);
  assert.match(event.description, /situation along the Thailand-Cambodia border/u);
  assert.doesNotMatch(event.description, /fragile.*ceasefire|direct consequence of.*hostilities/iu);
  assert.deepEqual(event.evidenceIds, [
    "170c3074c18ec9e6de488e3b9831d42b",
    "k974y04rk10a10yx8nb74yarg57z0hds",
  ]);
  for (const id of event.evidenceIds) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, "ect-jan9-kantharalak-sao-reschedule");
  }
});
