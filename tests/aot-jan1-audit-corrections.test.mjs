import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("AOT history does not invent a January 1 activation from a December 22 speech", () => {
  const decemberNews = readJsonl("data/news/2025-12.jsonl");
  const januaryNews = readJsonl("data/news/2026-01.jsonl");
  const decemberTimeline = readJsonl("data/timeline/2025-12.jsonl");
  const januaryTimeline = readJsonl("data/timeline/2026-01.jsonl");
  const article = decemberNews.find((row) => row.id === "k975wp5t4ejx6dgq6hhf70qrm57yg6w8");

  assert.ok(article);
  assert.equal(januaryNews.some((row) => row.id === article.id), false);
  assert.equal(new Date(article.publishedAt + 7 * 60 * 60 * 1000).toISOString().slice(0, 10), "2025-12-22");
  assert.match(article.summary, /December 22/u);
  assert.match(article.summary, /already actively engaging/u);
  assert.match(article.summary, /did not announce a new January 1 deployment/u);

  assert.equal(januaryTimeline.some((row) => row.id === "ks76zddf3ta2hhk9ecd87zafbs813rtt"), false);
  assert.ok(decemberTimeline.some((row) => row.id === "ks75ngagezt5e3ycx5p75r1byh8126rm"));
  assert.ok(januaryTimeline.some((row) => row.id === "ks784gkpjmkfme27ht7e5vqv61813mqk"));
});
