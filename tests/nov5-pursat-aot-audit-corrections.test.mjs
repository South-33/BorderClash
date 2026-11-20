import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7c2m8z1k4p9vx5trw3q7e6yb8hvf3b";
const evidenceId = "jn7c1m8z2k4p9vx5trw3q7e6yb8hvf2a";

test("November 5 AOT-KH milestone is date-only and records both Pursat inspection sites", () => {
  const event = readJsonl("data/timeline/2026-11.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-11-05");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /Stung Me Teuk Bridge/u);
  assert.match(event.description, /CH1 checkpoint/u);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("Thai post movement and bridge-strike claims remain attributed to Cambodia", () => {
  const event = readJsonl("data/timeline/2026-11.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.title, /Cambodian Defence Ministry Says/u);
  assert.match(event.description, /according to Cambodia's Defence Ministry/u);
  assert.match(event.description, /The ministry said Thai troops/u);
  assert.match(event.description, /These military-action claims are Cambodia's account/u);
  assert.match(event.description, /did not include a Thai response/u);
  assert.doesNotMatch(event.description, /Observers.*noted.*Thai troops/iu);
});

test("Thai and Khmer copy preserve the 20-metre figure and attribution", () => {
  const event = readJsonl("data/timeline/2026-11.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.descriptionTh, /20 เมตร/u);
  assert.match(event.descriptionTh, /ตามข้อมูลของกระทรวงกลาโหมกัมพูชา/u);
  assert.match(event.descriptionKh, /20 ម៉ែត្រ/u);
  assert.match(event.descriptionKh, /តាមការបញ្ជាក់របស់ក្រសួងការពារជាតិកម្ពុជា/u);
});

test("ANN summary identifies Phnom Penh Post republication and Cambodia source chain", () => {
  const article = readJsonl("data/news/2026-11.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.match(article.summary, /republished Phnom Penh Post/u);
  assert.match(article.summary, /Citing Cambodia's Defence Ministry/u);
  assert.match(article.summary, /did not include a Thai response/u);
});
