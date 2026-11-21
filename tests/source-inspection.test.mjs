import assert from "node:assert/strict";
import test from "node:test";
import { matchSourceInspection } from "../research/lib/source-inspection.mjs";

function registry(articles = []) {
  const byUrl = new Map();
  const byPublisherIdentity = new Map();
  for (const article of articles) {
    byUrl.set(article.sourceUrl, article);
  }
  return { byUrl, byPublisherIdentity };
}

test("source inspection identifies an existing canonical URL without mutating", () => {
  const article = { id: "a1", sourceUrl: "https://example.com/report", title: "Report" };
  const value = matchSourceInspection(
    article.sourceUrl,
    { finalUrl: article.sourceUrl, canonicalUrl: article.sourceUrl, usable: true },
    registry([article]),
  );
  assert.equal(value.outcome, "existing");
  assert.equal(value.readOnly, true);
  assert.equal(value.matches[0].id, "a1");
  assert.match(value.nextAction, /record a1 --captured/u);
});

test("source inspection leaves a new URL as a model retention decision", () => {
  const value = matchSourceInspection(
    "https://example.com/new",
    { finalUrl: "https://example.com/new", usable: true },
    registry(),
  );
  assert.equal(value.outcome, "new");
  assert.equal(value.matches.length, 0);
  assert.ok(value.remainingJudgment.includes("credibility"));
  assert.match(value.nextAction, /source add/u);
});
