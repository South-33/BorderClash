import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const targetId = "ks74n5fj538r4tgs46979ax6w9812xjm";
const freshId = "jn1fa8bdadcc4013ea3022572e3017e0";
const dapId = "jnf2e3974cc02e16c023b537b7ccc0ca";

test("unsupported Dec 14 Hun Sen retaliation milestone is not retained as canonical history", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  assert.equal(timeline.some((row) => row.id === targetId), false);
  assert.equal(timeline.some((row) => row.evidenceIds?.includes(freshId)), false);
  assert.equal(timeline.some((row) => row.evidenceIds?.includes(dapId)), false);
});

test("mismatched DAP evidence is repaired to the captured aid-distribution article", () => {
  const article = readJsonl("data/news/2025-12.jsonl").find((row) => row.id === dapId);
  assert.ok(article);
  assert.equal(article.category, "humanitarian");
  assert.equal(article.credibility, 70);
  assert.equal(article.sourceUrl, "https://dap-news.com/national/2025/12/14/560950/");
  assert.match(article.title, /ក្រសួងអភិវឌ្ឍន៍ជនបទ/u);
  assert.match(article.titleEn, /Deliver Supplies to Displaced People and Military Families/u);
  assert.match(article.summary, /six Cambodia-Thailand border provinces/u);
  assert.match(article.summary, /does not contain a Hun Sen F-16 retaliation warning/u);
  assert.doesNotMatch(article.title, /Hun Sen|F-16|retaliation/iu);
});

test("blocked Fresh News metadata is retained only as archived evidence, not timeline support", () => {
  const article = readJsonl("data/news/2025-12.jsonl").find((row) => row.id === freshId);
  assert.ok(article);
  assert.equal(article.status, "archived");
  assert.equal(article.credibility, 40);
});
