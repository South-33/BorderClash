import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const dec14Id = "ks78zhr9xpcg480tcp1579daxx813spx";
const dec12Id = "ks75kxqrqwcax8xk8hzcgh9yk98125pw";
const indianExpressId = "c8ad7939871670b75323074426bf7319";
const taipeiTimesId = "jn5f05c79a68dd63737e3568f3de4808";
const bangkokPostId = "js71avz2pj3kqggxfs15c9n6x57x93e6";

test("December 14 record is the first reported direct-combat civilian death, not the first civilian fatality overall", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const event = timeline.find((row) => row.id === dec14Id);
  assert.ok(event);
  assert.equal(event.date, "2025-12-14");
  assert.equal(event.timeOfDay ?? "", "");
  assert.match(event.title, /First Civilian Death Directly Caused/u);
  assert.match(event.description, /63-year-old Don Patchapan/u);
  assert.match(event.description, /first civilian death reported as a direct result of combat/u);
  assert.match(event.description, /December 12 Thai military report of three civilian deaths/u);
  assert.match(event.description, /specific causes were not identified/u);
  assert.match(event.description, /attributed to the Thai side's account/u);
  assert.deepEqual(event.evidenceIds, [indianExpressId, taipeiTimesId]);
});

test("December 12 and December 14 remain distinct milestones with compatible claims", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const dec12 = timeline.find((row) => row.id === dec12Id);
  const dec14 = timeline.find((row) => row.id === dec14Id);
  assert.ok(dec12);
  assert.ok(dec14);
  assert.match(dec12.description, /three Thai civilians had been killed/u);
  assert.match(dec12.description, /did not identify the specific cause/u);
  assert.match(dec14.description, /direct result of combat/u);
});

test("English, Thai and Khmer preserve the direct-combat distinction and Thai attribution", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === dec14Id);
  assert.ok(event);
  for (const field of ["description", "descriptionTh", "descriptionKh"]) {
    assert.match(event[field], /63/u);
  }
  assert.match(event.descriptionTh, /การสู้รบโดยตรง/u);
  assert.match(event.descriptionTh, /คำกล่าวของฝ่ายไทย/u);
  assert.match(event.descriptionKh, /ការប្រយុទ្ធដោយផ្ទាល់/u);
  assert.match(event.descriptionKh, /ការអះអាងរបស់ភាគីថៃ/u);
});

test("AP mirror is one provenance chain and Bangkok Post summary keeps the direct-combat qualifier", () => {
  const articles = readJsonl("data/news/2025-12.jsonl");
  const apMirror = articles.find((row) => row.id === indianExpressId);
  const bangkokPost = articles.find((row) => row.id === bangkokPostId);
  assert.ok(apMirror);
  assert.ok(bangkokPost);
  assert.equal(apMirror.provenanceId, "associated-press-dec14-thai-civilian-combat-death");
  assert.match(apMirror.summary, /direct result of combat/u);
  assert.match(bangkokPost.summary, /first civilian fatality directly caused by combat/u);
});
