import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8")
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test("Hun Manet border remarks distinguish loss of control from legal loss of territory on Sep 16", () => {
  const timeline = readJsonl("data/timeline/2026-09.jsonl");
  const event = timeline.find((row) => row.id === "ks78e5f1mvtctbtc01b623bpmx8ejsd9");
  assert.ok(event);
  assert.equal(event.date, "2026-09-16");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Lost Control in Some Areas, Not Territory/u);
  assert.match(event.description, /had lost control of some areas/u);
  assert.match(event.description, /had not surrendered or legally transferred/u);
  assert.match(event.description, /did not determine the border/u);
  assert.match(event.description, /must be handled through the JBC/u);
  assert.match(event.description, /Cambodia considers its legitimate territory/u);
  assert.deepEqual(event.evidenceIds, [
    "jn7ekp4b0y6s9t91wkd9h6dz0s8ejkja",
    "95e56c86a4575450bee5cd3cc20ee591",
  ]);
});

test("Khmer Times attribution is scored as strong rather than independently verified territory fact", () => {
  const news = readJsonl("data/news/2026-09.jsonl");
  const khmerTimes = news.find((row) => row.id === "jn7ekp4b0y6s9t91wkd9h6dz0s8ejkja");
  const akp = news.find((row) => row.id === "95e56c86a4575450bee5cd3cc20ee591");
  assert.ok(khmerTimes);
  assert.ok(akp);
  assert.equal(khmerTimes.credibility, 80);
  assert.match(khmerTimes.summary, /distinction between losing control/u);
  assert.match(akp.summary, /September 16, 2026/u);
  assert.match(akp.summary, /date and venue/u);
});
