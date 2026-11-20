import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const protestId = "ks70v4ja5sqmgzkqhs69w7aj6n84psgc";
const flagId = "ks7cn6q3h8af5dk9rchcmf7tyh84tp0y";
const duplicateFlagId = "ks7f7bnmctq6j29x60ax91525x84p3bv";
const articleId = "jn75mkn4zmx9ps9qq0544k72b184sgvq";

test("O'Smach protest is dated to the April 10 MFA press release", () => {
  const timeline = readJsonl("data/timeline/2026-04.jsonl");
  const protest = timeline.find((row) => row.id === protestId);
  assert.ok(protest);
  assert.equal(protest.date, "2026-04-10");
  assert.equal(protest.timeOfDay, "");
  assert.equal(protest.category, "diplomatic");
  assert.match(protest.description, /April 10/u);
  assert.match(protest.description, /April 6/u);
  assert.match(protest.description, /Boundary Pillars 52 and 54 from April 2/u);
  assert.match(protest.description, /April 7 Thai-led media visit/u);
  assert.match(protest.description, /Cambodian government claims/u);
  assert.deepEqual(protest.evidenceIds, [articleId]);
});

test("April 6 flag incident remains distinct and date-only", () => {
  const timeline = readJsonl("data/timeline/2026-04.jsonl");
  const flag = timeline.find((row) => row.id === flagId);
  assert.ok(flag);
  assert.equal(flag.date, "2026-04-06");
  assert.equal(flag.timeOfDay, "");
  assert.match(flag.title, /Cambodian MFA Says/u);
  assert.match(flag.description, /eastern embankment of the second canal/u);
  assert.match(flag.description, /source gives no exact time/u);
  assert.match(flag.description, /does not independently verify the territorial claim/u);
  assert.deepEqual(flag.evidenceIds, [articleId]);
});

test("duplicate April 6 flag row is removed", () => {
  const timeline = readJsonl("data/timeline/2026-04.jsonl");
  assert.equal(timeline.some((row) => row.id === duplicateFlagId), false);
});

test("Khmer Times article summary preserves incident dates and press-release chronology", () => {
  const article = readJsonl("data/news/2026-04.jsonl").find((row) => row.id === articleId);
  assert.ok(article);
  assert.equal(article.category, "diplomatic");
  assert.match(article.summary, /issued a press release on April 10/u);
  assert.match(article.summary, /April 6/u);
  assert.match(article.summary, /from April 2/u);
  assert.match(article.summary, /on April 7/u);
});

test("O'Smach multilingual copy is not encoding-corrupted", () => {
  const timeline = readJsonl("data/timeline/2026-04.jsonl");
  for (const id of [protestId, flagId]) {
    const row = timeline.find((item) => item.id === id);
    assert.ok(row);
    assert.doesNotMatch(row.title + row.description + row.titleTh + row.descriptionTh + row.titleKh + row.descriptionKh, /�/u);
    assert.match(row.titleTh + row.descriptionTh, /[\u0E00-\u0E7F]/u);
    assert.match(row.titleKh + row.descriptionKh, /[\u1780-\u17FF]/u);
  }
});
