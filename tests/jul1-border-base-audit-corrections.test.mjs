import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks74zs2b4t4x32w4km1e5g0x2s89pp0a";
const evidenceId = "js7833kbw6qsagffedy5b4svks89pkp9";

test("unsupported Jul 1 border-base milestone is not retained as canonical history", () => {
  const timeline = readJsonl("data/timeline/2026-07.jsonl");
  assert.equal(timeline.some((row) => row.id === eventId), false);
  assert.equal(timeline.some((row) => row.evidenceIds?.includes(evidenceId)), false);
});

test("headline-only One31 evidence is retained with its limitations recorded", () => {
  const article = readJsonl("data/news/2026-07.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.equal(article.source, "One31");
  assert.equal(article.status, "unverified");
  assert.equal(article.credibility, 40);
  assert.match(article.summary, /preserves only a headline/u);
  assert.match(article.summary, /article body was not captured/u);
  assert.match(article.summary, /does not source-verify/u);
  assert.doesNotMatch(article.summary, /describing the situation as fragile/u);
});

test("evidence metadata does not overstate the unsupported operational claim", () => {
  const article = readJsonl("data/news/2026-07.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.match(article.summary, /about 30 metres/u);
  assert.match(article.summary, /20–30 metre range/u);
  assert.match(article.summary, /boundary and sovereignty implications/u);
});
