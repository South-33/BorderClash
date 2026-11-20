import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Feb 8 Cambodian container-road protest consolidates its Feb 5/7 allegations without reviving the moved O'Smach row", () => {
  const timeline = readJsonl("data/timeline/2026-02.jsonl");
  const event = timeline.find((row) => row.id === "ks710qg8dyeg0nj1qwq11gqqgd8137tt");
  const news = readJsonl("data/news/2026-02.jsonl");

  assert.ok(event);
  assert.equal(event.date, "2026-02-08");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(event.importance, 74);
  assert.match(event.description, /February 5/u);
  assert.match(event.description, /February 7/u);
  assert.match(event.description, /remain Cambodia's allegations/u);
  assert.deepEqual(event.evidenceIds, [
    "f206ee8675a4564ce346bded4cbb4c18",
    "jn7bpj8470x9v15qgt6ymcz8c181g5dv",
    "jn76a1maet191fsnw0kmdf688h80vhkh",
  ]);
  assert.equal(timeline.some((row) => row.id === "ks7d3714nyta4jycyxmq5m3w2s81gd8p"), false);
  assert.equal(timeline.some((row) => row.id === "ks70sfync3mka2mtffee84wjjd8130g7"), false);
  assert.equal(timeline.some((row) => row.date === "2026-02-07" && row.id === "ks7czz087ph08ap98c9nh052dx812ddk"), true);

  const provenanceId = "cambodia-mfa-feb8-container-road-protest";
  for (const id of event.evidenceIds) assert.equal(news.find((row) => row.id === id)?.provenanceId, provenanceId);
  assert.equal(news.find((row) => row.id === "jn7bpj8470x9v15qgt6ymcz8c181g5dv")?.category, "diplomatic");
});
