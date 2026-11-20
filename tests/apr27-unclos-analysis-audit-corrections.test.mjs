import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path) { return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse); }
const removedId = "ks77tg3erdygxfv5z191bht2wh85mztb";
const nscId = "ks76kr499qfbggq173g3z09rts85gmk7";
const bruneiId = "ks72qecfb0yr2awgcp36tcg25d85q4gy";
const postId = "jn7ah31j4m6bcjcva16j4dtsd585mxnv";
const starId = "k970sf6m5tg8wh5d2ncwdxh2js85mqer";
const provenanceId = "phnom-penh-post-ann-unclos-apr27";

test("Apr 27 UNCLOS analysis is removed while the real Apr 23 and Apr 27 milestones remain", () => {
  const timeline = readJsonl("data/timeline/2026-04.jsonl");
  assert.equal(timeline.find((row) => row.id === removedId), undefined);
  const nsc = timeline.find((row) => row.id === nscId);
  const brunei = timeline.find((row) => row.id === bruneiId);
  assert.ok(nsc);
  assert.ok(brunei);
  assert.equal(nsc.date, "2026-04-23");
  assert.match(nsc.description, /NSC policy decision rather than the final legal withdrawal/u);
  assert.equal(brunei.date, "2026-04-27");
  assert.match(brunei.title, /Reaffirm Ceasefire in Brunei/u);
  assert.match(brunei.description, /rebuilding mutual trust/u);
  assert.doesNotMatch(brunei.description, /formal.*MOU 44.*cancel/iu);
});

test("Phnom Penh Post and The Star analysis share provenance and remain news context", () => {
  const news = readJsonl("data/news/2026-04.jsonl");
  const post = news.find((row) => row.id === postId);
  const star = news.find((row) => row.id === starId);
  assert.ok(post); assert.ok(star);
  assert.equal(post.provenanceId, provenanceId);
  assert.equal(star.provenanceId, provenanceId);
  for (const row of [post, star]) {
    assert.match(row.summary, /March 8/u);
    assert.match(row.summary, /prepar|review/u);
    assert.match(row.summary, /Pou Sothirak/u);
    assert.doesNotMatch(row.summary, /Thailand.*(?:scrapped|cancelled).*MOU 44/u);
  }
});