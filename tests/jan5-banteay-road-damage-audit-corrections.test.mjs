import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Banteay Meanchey road-damage tally is anchored to the Jan 5 authority report", () => {
  const timeline = readJsonl("data/timeline/2026-01.jsonl");
  const news = readJsonl("data/news/2026-01.jsonl");
  const event = timeline.find((row) => row.id === "ks75rdjt9at88sr9yhkmskcg3s812ket");
  const article = news.find((row) => row.id === "jn7fjqsa4n5f5qe7gmfvgqz0b57yq65n");

  assert.ok(event);
  assert.ok(article);
  assert.equal(event.date, "2026-01-05");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Tally 80 Roads Damaged/u);
  assert.match(event.description, /afternoon of January 5/u);
  assert.match(event.description, /December 7-27 fighting/u);
  assert.match(event.description, /post-conflict assessment, not a new January 5 attack/u);
  assert.match(event.description, /Cambodian local authorities/u);
  assert.match(article.summary, /Published January 6/u);
  assert.match(article.summary, /assessment on the afternoon of January 5/u);
  assert.deepEqual(event.evidenceIds, [article.id]);
});
