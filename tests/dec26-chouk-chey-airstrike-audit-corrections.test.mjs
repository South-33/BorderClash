import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Dec 26 Chouk Chey row distinguishes Cambodia's bomb claim from Thailand's confirmed air operation", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const news = readJsonl("data/news/2025-12.jsonl");
  const event = timeline.find((row) => row.id === "ks7a14pgvgb5zmjbe4bqek4qxh8132wr");
  const bad = news.find((row) => row.id === "k97a5frbwhf79exg7tc07mtsph7y2qnb");
  const akp = news.find((row) => row.id === "1c4ba12c5e7d846f7298608debc978e9");
  const ap = news.find((row) => row.id === "bda1482c29d30b4e5b823cb8c38b27c7");

  assert.ok(event);
  assert.ok(bad);
  assert.ok(akp);
  assert.ok(ap);
  assert.equal(event.date, "2025-12-26");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Thailand Confirms Dec 26 Chouk Chey Air Operation/u);
  assert.match(event.description, /between 6:08 and 7:15 a\.m\./u);
  assert.match(event.description, /up to 40 bombs/u);
  assert.match(event.description, /Thailand's military confirmed/u);
  assert.match(event.description, /remained its own claims/u);
  assert.deepEqual(event.evidenceIds, [
    "1c4ba12c5e7d846f7298608debc978e9",
    "bda1482c29d30b4e5b823cb8c38b27c7",
    "k9707wv7c3hvknakzsj68my59h7y1gpy",
  ]);
  assert.equal(event.evidenceIds.includes(bad.id), false);
  assert.equal(bad.sourceUrl, "https://www.akp.gov.kh/post/detail/357417/");
  assert.equal(bad.source, "AKP / Opinion");
  assert.match(bad.title, /^OPINION:/u);
  assert.match(bad.summary, /commentary, not independent verification/u);
  assert.equal(bad.credibility, 50);
  assert.equal(akp.provenanceId, "cambodia-mod-dec26-chouk-chey-airstrike-claim");
  assert.match(ap.summary, /Thailand's military confirmed the attack/u);
});
