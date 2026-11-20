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

test("Sep 15 UNCLOS milestone records the first Conciliation Commission meeting without invented time", () => {
  const timeline = readJsonl("data/timeline/2026-09.jsonl");
  const event = timeline.find((row) => row.id === "ks7drv7hewkh415w82wamxvnxx8eejbm");
  assert.ok(event);
  assert.equal(event.date, "2026-09-15");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Conciliation Commission/u);
  assert.match(event.description, /Prak Sokhonn/u);
  assert.match(event.description, /Sihasak Phuangketkeow/u);
  assert.match(event.description, /joint development and equitable resource sharing/u);
  assert.match(event.description, /participating in good faith/u);
  assert.match(event.description, /non-binding/u);
});

test("Reuters summary uses conciliation terminology rather than loose arbitration framing", () => {
  const news = readJsonl("data/news/2026-09.jsonl");
  const article = news.find((row) => row.id === "k9786582rzbjrj162ew9ns03j98efkxv");
  assert.ok(article);
  assert.match(article.summary, /UNCLOS Conciliation Commission/u);
  assert.doesNotMatch(article.summary, /UN arbitration process/u);
});
