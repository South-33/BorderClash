import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const duplicateId = "ks74az33f3d9w1h4zc6xjk1kpd855qvy";
const survivorId = "ks7f1z2f366e1tvz2xp98vmyfd844hmf";
const articleId = "k976m67kvd139wdrac3d27rtvd854dyq";

test("retrospective April displacement snapshot is removed from the durable timeline", () => {
  const timeline = readJsonl("data/timeline/2026-04.jsonl");
  assert.equal(timeline.some((row) => row.id === duplicateId), false);

  const survivor = timeline.find((row) => row.id === survivorId);
  assert.ok(survivor);
  assert.equal(survivor.date, "2026-04-03");
  assert.equal(survivor.timeOfDay, "");
  assert.match(survivor.description, /610,000/u);
  assert.match(survivor.description, /34,937/u);
  assert.match(survivor.description, /Interior Ministry said/u);
});

test("later Khmer Times article remains retained as evidence", () => {
  const article = readJsonl("data/news/2026-04.jsonl").find((row) => row.id === articleId);
  assert.ok(article);
  assert.equal(article.source, "Khmer Times");
  assert.match(article.summary, /94 percent/u);
  assert.match(article.summary, /34,000/u);
});
