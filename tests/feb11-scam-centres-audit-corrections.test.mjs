import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Feb 11 scam-centre milestone records the cumulative crackdown and broader compound exodus", () => {
  const timeline = readJsonl("data/timeline/2026-02.jsonl");
  const event = timeline.find((row) => row.id === "ks728jadnxyvb0ysesxz78drqd812f7j");

  assert.ok(event);
  assert.equal(event.date, "2026-02-11");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(event.title, "Cambodia Reports Scam-Centre Crackdown as Thousands Leave Compounds");
  assert.match(event.description, /sealed about 190 scam-centre locations in recent weeks/u);
  assert.match(event.description, /173 senior figures/u);
  assert.match(event.description, /11,000 workers/u);
  assert.match(event.description, /thousands of scam workers/u);
  assert.match(event.description, /Associated Press/u);
  assert.match(event.description, /not to sustained Thai military pressure/u);
  assert.doesNotMatch(event.description, /remove a major justification|aims to remove/iu);
  assert.deepEqual(event.evidenceIds, [
    "k978tkwkq42dp7fq696gk29d8x811t0k",
    "366e94b62fb54cb6daa2528865a79a53",
  ]);
});

test("Reuters article summary does not invent a border-war motive for the crackdown", () => {
  const news = readJsonl("data/news/2026-02.jsonl");
  const article = news.find((row) => row.id === "k978tkwkq42dp7fq696gk29d8x811t0k");
  assert.ok(article);
  assert.equal(article.category, "political");
  assert.match(article.summary, /sealed about 190 scam-centre locations in recent weeks/u);
  assert.match(article.summary, /campaign that began late in 2025/u);
  assert.doesNotMatch(article.summary, /conflict was significantly driven|remove a major justification/iu);
});

test("same-day humanitarian exodus is merged into the crackdown milestone instead of duplicated", () => {
  const timeline = readJsonl("data/timeline/2026-02.jsonl");
  const merged = timeline.find((row) => row.id === "ks728jadnxyvb0ysesxz78drqd812f7j");
  assert.ok(merged);
  assert.equal(timeline.some((row) => row.id === "ks7c7epg90jh284q4zzkmq7r098131ay"), false);
  assert.ok(merged.evidenceIds.includes("366e94b62fb54cb6daa2528865a79a53"));
  assert.match(merged.description, /Caritas shelter/u);
});
