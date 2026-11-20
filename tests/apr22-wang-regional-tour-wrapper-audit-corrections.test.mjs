import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const wrapperId = "ks758jssgbw00pvq7az32gc2w585f10k";
const wangHunManetId = "ks70mj2rvm357nmryrabk5z6jd85dcw4";
const dialogueId = "ks75qq5e6x3dq40zf7ghga6ctd85bdkt";
const officialTripId = "68944204d24ad3de40e899cc5a14bb96";
const blockedAnalysisId = "js7e6h5s8sqv07frg8v00ce52s85fafw";

test("Apr 22 regional-tour wrapper is removed while substantive meetings remain", () => {
  const rows = readJsonl("data/timeline/2026-04.jsonl");
  assert.equal(rows.some((row) => row.id === wrapperId), false);
  assert.ok(rows.some((row) => row.id === wangHunManetId));
  assert.ok(rows.some((row) => row.id === dialogueId));
});

test("official Chinese MFA announcement records the broader Apr 22-26 itinerary", () => {
  const news = readJsonl("data/news/2026-04.jsonl");
  const article = news.find((row) => row.id === officialTripId);
  assert.ok(article);
  assert.equal(article.source, "Ministry of Foreign Affairs of China");
  assert.equal(article.credibility, 100);
  assert.match(article.summary, /April 22 to 26, 2026/u);
  assert.match(article.summary, /Cambodia, Thailand and Myanmar/u);
  assert.match(article.summary, /first China-Cambodia 2\+2 strategic dialogue/u);
  assert.doesNotMatch(article.summary, /mediat|border dispute|economic interests/iu);
});

test("blocked analytical article no longer supports any timeline event", () => {
  const rows = readJsonl("data/timeline/2026-04.jsonl");
  assert.equal(rows.some((row) => row.evidenceIds?.includes(blockedAnalysisId)), false);
});
