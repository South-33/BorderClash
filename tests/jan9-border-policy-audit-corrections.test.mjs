import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Jan 9 Thai border policy keeps supported measures without implying territorial proof", () => {
  const timeline = readJsonl("data/timeline/2026-01.jsonl");
  const news = readJsonl("data/news/2026-01.jsonl");
  const event = timeline.find((row) => row.id === "ks738rbzr7vaykrhhd8esy32w1812a3n");
  assert.ok(event);
  assert.equal(event.date, "2026-01-09");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /necessary sectors/u);
  assert.match(event.description, /at least one year/u);
  assert.match(event.description, /electronic fencing and CCTV/u);
  assert.match(event.description, /permanent physical barriers in selected areas/u);
  assert.match(event.description, /does not treat them as proof of sovereignty/u);
  assert.doesNotMatch(event.description, /solidify territorial control/iu);

  const provenance = "thai-defence-minister-jan9-border-measures";
  for (const id of [
    "js7dvf3rsnxx1458bp4awbtmfs7z66xx",
    "js76xrw783jxb91yjvbe8fgk057yyy7p",
    "k977z6zjafyha8x7v6nt400bpd7yyhcd",
    "js71wsghn5zp3qkvk252abyryx7z7rjt",
  ]) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, provenance);
  }
});
