import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7bbsanhgeqr0fgxqr0cwprah85454n";
const articleId = "k974q36jpgen4d7qfyp8pgh05d855h2a";

test("ordinary Apr 18 immigration repatriation is not a standalone conflict timeline milestone", () => {
  const timeline = readJsonl("data/timeline/2026-04.jsonl");
  assert.equal(timeline.some((row) => row.id === eventId), false);
});

test("Khmer Times evidence keeps the actual repatriation facts without invented displacement linkage", () => {
  const article = readJsonl("data/news/2026-04.jsonl").find((row) => row.id === articleId);
  assert.ok(article);
  assert.equal(article.status, "archived");
  assert.equal(new Date(article.publishedAt).toISOString(), "2026-04-20T07:00:00.000Z");
  assert.match(article.summary, /14:00 on Saturday, April 18/u);
  assert.match(article.summary, /106 Cambodian nationals/u);
  assert.match(article.summary, /64 men, 25 women and 17 children/u);
  assert.match(article.summary, /did not connect the repatriation to Cambodia’s conflict-displacement figures/u);
  assert.doesNotMatch(article.summary, /94 percent/u);
  assert.doesNotMatch(article.summary, /34,000/u);
});
