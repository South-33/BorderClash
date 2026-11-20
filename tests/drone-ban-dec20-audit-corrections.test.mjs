import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("drone restriction is anchored to the December 20 announcement without unrelated battlefield strands", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const decNews = readJsonl("data/news/2025-12.jsonl");
  const janNews = readJsonl("data/news/2026-01.jsonl");
  const event = timeline.find((row) => row.id === "ks77z79ya9mjsyaf2q2bdes769812y8y");
  const dailyNews = decNews.find((row) => row.id === "js7f18ybntxwzmtkv1ammtrdhn7xphj3");
  const prd = decNews.find((row) => row.id === "c4a697dcec6040a1ebcba46fdfb47bb1");
  const nbtc = janNews.find((row) => row.id === "6a1599172176766e7427fd88d85c81ee");

  assert.ok(event);
  assert.ok(dailyNews);
  assert.ok(prd);
  assert.ok(nbtc);
  assert.equal(event.date, "2025-12-20");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /8 Provinces and 2 Districts/u);
  assert.match(event.description, /took effect on December 20/u);
  assert.match(event.description, /does not include the separate airstrike and Hill 350 developments/u);
  assert.deepEqual(event.evidenceIds, [prd.id, nbtc.id, dailyNews.id]);
  assert.equal(prd.provenanceId, "thai-defense-dec20-drone-ban");
  assert.equal(dailyNews.provenanceId, prd.provenanceId);
  assert.match(dailyNews.summary, /announcement itself was issued on December 20/u);
  assert.match(nbtc.summary, /took effect on December 20, 2025/u);
});
