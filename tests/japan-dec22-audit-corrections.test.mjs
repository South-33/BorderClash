import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Dec 22 Japan row uses the Japan statement evidence instead of unrelated Thai cabinet copy", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === "ks7b87d722syae1gkm00z9qsgx8139zm");
  const article = readJsonl("data/news/2025-12.jsonl").find((row) => row.id === "js7cgck37s6bmccgx73c6w4jax7xtfbw");

  assert.ok(event);
  assert.ok(article);
  assert.equal(event.date, "2025-12-22");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Japan Welcomes ASEAN De-escalation Step/u);
  assert.match(event.description, /ASEAN Special Foreign Ministers' Meeting/u);
  assert.match(event.description, /maximum restraint/u);
  assert.doesNotMatch(event.description, /cease hostilities immediately/iu);
  assert.deepEqual(event.evidenceIds, [article.id]);

  assert.equal(article.source, "Khmer Times");
  assert.equal(article.category, "diplomatic");
  assert.match(article.title, /Japan opposes actions escalating/u);
  assert.match(article.summary, /Japan's December 22 Foreign Ministry statement/u);
  assert.doesNotMatch(article.summary, /Cabinet approved|Trump/iu);
  assert.equal(article.titleEn, undefined);
});
