import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("second T59D shipment is dated June 15, date-only, and remains attributed", () => {
  const event = readJsonl("data/timeline/2026-06.jsonl").find((row) => row.id === "ks7dc3g2db5mc0qhybs5fc50bs88p13t");
  assert.ok(event);
  assert.equal(event.date, "2026-06-15");
  assert.equal(event.timeOfDay, "");
  assert.match(event.title, /^Siam Rath Reports/u);
  assert.match(event.description, /around midnight/u);
  assert.match(event.description, /does not independently confirm the arrival/u);
  assert.doesNotMatch(event.description, /This audit/u);
  assert.doesNotMatch(event.description, /Cambodia received/u);
  assert.equal(event.importance, 70);
});

test("Siam Rath publication time matches its June 15 03:28 local timestamp", () => {
  const article = readJsonl("data/news/2026-06.jsonl").find((row) => row.id === "js7a71htkgbd335aab05j436w188q77a");
  assert.ok(article);
  assert.equal(new Date(article.publishedAt).toISOString(), "2026-06-14T20:28:00.000Z");
  assert.match(article.summary, /reported that a second shipment/u);
  assert.match(article.summary, /had not been confirmed/u);
});
