import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Chanthaburi fence inspection keeps the older stable ID and the June 27 event date", () => {
  const timeline = readJsonl("data/timeline/2026-06.jsonl");
  const event = timeline.find((row) => row.id === "ks7fh3dftg506w80bxghe3vrx589f85c");

  assert.ok(event);
  assert.equal(event.date, "2026-06-27");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(event.importance, 65);
  assert.match(event.title, /House Committee Inspects Chanthaburi Border Fence/u);
  assert.match(event.description, /construction was 45% complete/u);
  assert.match(event.description, /border marker 52 was temporary/u);
  assert.match(event.description, /8\.3 kilometres/u);
  assert.deepEqual(event.evidenceIds, [
    "js7b51yg06aycm8t4qgxsdw1c989ge4e",
    "k977ms1drj4d6aw5snh55ccaf189kqzm",
  ]);
  assert.equal(timeline.some((row) => row.id === "ks7fwm34k0g83ncdxddhwvt4r189kycs"), false);
});

test("reports of the June 27 fence inspection share one provenance chain", () => {
  const news = readJsonl("data/news/2026-06.jsonl");
  const byId = new Map(news.map((row) => [row.id, row]));
  for (const id of [
    "k977gg12k35s89cxf40556z6ad89g0hh",
    "js78v8757h7dy9pnzyy11wxy8189fzew",
    "js7560jg5kh8jxzgza6r7pjr2189kf7x",
    "k977ms1drj4d6aw5snh55ccaf189kqzm",
    "js7b51yg06aycm8t4qgxsdw1c989ge4e",
  ]) {
    assert.equal(byId.get(id)?.provenanceId, "thai-house-fence-inspection-jun27");
  }
});
