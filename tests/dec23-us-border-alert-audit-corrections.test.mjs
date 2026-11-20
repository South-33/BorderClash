import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks74trahrp027sy46mj21h32ah812mgg";
const evidenceId = "ca80faa7edf2af603230f75ff9dd206e";

test("Dec 23 U.S. border warning has no invented exact time", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-23");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(event.category, "humanitarian");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("milestone is limited to the captured secondary reproduction of the embassy warning", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /Dallas Express/u);
  assert.match(event.description, /50 kilometres/u);
  assert.match(event.description, /conditions remained volatile/u);
  assert.match(event.description, /does not independently establish/u);
  assert.match(event.description, /exact update time/u);
  assert.doesNotMatch(event.description, /emergency services are limited/u);
  assert.doesNotMatch(event.title, /Urgent|New/u);
});

test("Thai and Khmer copies preserve the 50km warning and source boundary", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event.descriptionTh.includes("50"));
  assert.ok(event.descriptionKh.includes("50"));
  assert.match(event.descriptionTh, /รายงานทุติยภูมิ/u);
  assert.match(event.descriptionKh, /របាយការណ៍បន្ទាប់បន្សំ/u);
});

test("Dallas Express evidence row is retained as an archived secondary report", () => {
  const article = readJsonl("data/news/2025-12.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.equal(article.source, "Dallas Express");
  assert.equal(article.status, "archived");
  assert.equal(article.credibility, 60);
  assert.match(article.summary, /updated on December 23/u);
  assert.match(article.summary, /50 kilometers/u);
});
