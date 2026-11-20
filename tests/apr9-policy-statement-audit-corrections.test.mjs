import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks73h1s8f5yzx44xjenrhth1cs851jx0";
const evidenceId = "k978ctqs1twqafvtaa5cpvy64n850srs";

test("Apr 9 policy statement keeps the wall pledge but bounds MOU 44 to a cancellation study", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-04-09");
  assert.equal(event.timeOfDay, "");
  assert.match(event.description, /April 9-10/u);
  assert.match(event.description, /building a border wall/u);
  assert.match(event.description, /expedite a study of possible cancellation/u);
  assert.match(event.description, /did not announce that the agreement had already been cancelled/u);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("Apr 9 policy statement localizations preserve the same MOU 44 uncertainty", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.titleTh + event.descriptionTh, /[\u0E00-\u0E7F]/u);
  assert.match(event.titleKh + event.descriptionKh, /[\u1780-\u17FF]/u);
  assert.match(event.descriptionTh, /ศึกษาความเป็นไปได้/u);
  assert.match(event.descriptionKh, /សិក្សាអំពីលទ្ធភាព/u);
  assert.doesNotMatch(event.descriptionTh + event.descriptionKh, /\?|�/u);
});

test("Prachatai evidence summary does not turn the study into a completed cancellation", () => {
  const article = readJsonl("data/news/2026-04.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.match(article.summary, /April 9-10/u);
  assert.match(article.summary, /possible cancellation/u);
  assert.match(article.summary, /did not say the agreement had already been cancelled/u);
});
