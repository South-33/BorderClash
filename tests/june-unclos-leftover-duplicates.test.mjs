import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("retrospective June 12 UNCLOS initiation row is absent while the June 2 survivor remains", () => {
  const timeline = readJsonl("data/timeline/2026-06.jsonl");
  assert.equal(timeline.some((row) => row.id === "ks7cf4svv9675tdpax9zdeh43s88pbrh"), false);
  const launch = timeline.find((row) => row.id === "ks7ffpj44tarr5s6713ptwaxrn87zmxr");
  assert.ok(launch);
  assert.equal(launch.date, "2026-06-02");
});

test("June 5 Anutin border-closure row is absorbed into the UNCLOS participation survivor", () => {
  const timeline = readJsonl("data/timeline/2026-06.jsonl");
  assert.equal(timeline.some((row) => row.id === "ks78x0x6p40k48dxsgth1de0hh882j4a"), false);

  const survivor = timeline.find((row) => row.id === "ks780sbdv26f4mzfc3q9qj8t7n885c8g");
  assert.ok(survivor);
  assert.equal(survivor.date, "2026-06-05");
  assert.match(survivor.description, /other bilateral talks, including land-border discussions, on hold/u);
  assert.match(survivor.description, /keep border gates closed/u);
  assert.deepEqual(survivor.evidenceIds, [
    "js77zc39f1b5fqxk7ggpm07j25885kzp",
    "js78zww5jx7afbg3bdvnyetpw588579b",
  ]);
});

test("Straits Times Reuters copy shares the June 5 participation provenance chain", () => {
  const news = readJsonl("data/news/2026-06.jsonl");
  const article = news.find((row) => row.id === "k9746sxf09mrm92ktf5xh0t1kh882n6h");
  assert.ok(article);
  assert.equal(article.provenanceId, "reuters-jun5-thailand-unclos-participation");
});

test("later UNCLOS milestones remain distinct", () => {
  const timeline = readJsonl("data/timeline/2026-06.jsonl");
  assert.ok(timeline.some((row) => row.id === "ks7f96vtq164v13njvfcpz8j9n88we0s"));
  assert.ok(timeline.some((row) => row.id === "ks7eazhdgzqw5wp2zmcvqftv0x88yec1"));
  assert.equal(timeline.some((row) => row.id === "ks75bw0qvj0ygf0bm75m7btw5h8936we"), false);
});
