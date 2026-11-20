import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("April JBC proposal is one April 7 milestone with shared statement provenance", () => {
  const timeline = readJsonl("data/timeline/2026-04.jsonl");
  const event = timeline.find((row) => row.id === "ks7cy6t35j9sbhzhgvccwg7ncn84f0jn");
  const news = readJsonl("data/news/2026-04.jsonl");
  const ids = [
    "jn7adf460bnkq5jqk3xrwvmt75855s0e",
    "jn73d9wjy4mkb17m922bh2mhhd84fpn3",
    "jn7fn8m7s4r46s703jv18bq0bh84jvzv",
    "jn70ajafpqtf16dps19gzgaeyn84ebc4",
    "jn70ynh2pq7sazgq9d6tmxj2q184grjt",
  ];

  assert.ok(event);
  assert.equal(event.date, "2026-04-07");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(timeline.some((row) => row.id === "ks7311e743x858j0rk769yv2xx855jp1"), false);
  assert.equal(timeline.some((row) => row.id === "ks781naq94zvht7btzt9tn23sd84g3bp"), false);
  assert.match(event.description, /Note Verbale dated April 7/u);
  assert.match(event.description, /April 17 to 22/u);
  assert.match(event.description, /April 20 to 24/u);
  assert.match(event.description, /sovereignty claim remained disputed/u);
  assert.deepEqual(event.evidenceIds, ids.slice(0, 4));
  for (const id of ids) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, "cambodia-jbc-note-2026-04-07");
  }
  const akp = news.find((row) => row.id === ids[0]);
  assert.equal(akp?.credibility, 70);
  assert.match(akp?.summary || "", /latest Note Verbale was dated April 7/u);
});
