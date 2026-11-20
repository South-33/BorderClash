import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("May 2 Philippines mediation row records Sihasak's disclosure, not a completed meeting", () => {
  const event = readJsonl("data/timeline/2026-05.jsonl")
    .find((row) => row.id === "ks7a154grwqtq8my4ypr4hnp4n863e85");
  const article = readJsonl("data/news/2026-05.jsonl")
    .find((row) => row.id === "js7992ene8sj7kazb4yracq7g5862c2t");

  assert.ok(event);
  assert.ok(article);
  assert.equal(event.date, "2026-05-02");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Sihasak Says Philippines Offered/u);
  assert.match(event.description, /could be held/u);
  assert.match(event.description, /not the trilateral leaders' meeting/u);
  assert.match(event.description, /May 7/u);
  assert.match(article.summary, /On May 2/u);
  assert.match(article.summary, /still prospective/u);
});
