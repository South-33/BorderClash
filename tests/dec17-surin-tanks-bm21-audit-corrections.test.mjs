import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks709tjqzwccx0cfk0ksd4eycn813c42";
const evidenceId = "js7ckc0kgaq4p5r9fvacncvp317xh3v3";

test("December 17 Surin row removes the unsupported 18:00 event time", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-17");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /2nd Army Reports Cambodian Tanks/u);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("event distinguishes the Dec 17 fighting from the Dec 18 summary publication", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /December 18 summary of fighting on December 17/u);
  assert.match(event.description, /two BM-21 rounds impacted civilian areas/u);
  assert.match(event.description, /fragments damaged a roof/u);
  assert.match(event.description, /without injuries or property damage/u);
  assert.doesNotMatch(event.description, /13 fronts/u);
});

test("Thai and Khmer copy preserve the two impact points and Thai attribution", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.descriptionTh, /2 จุด/u);
  assert.match(event.descriptionTh, /เป็นรายงานของกองทัพไทย/u);
  assert.match(event.descriptionKh, /2 កន្លែង/u);
  assert.match(event.descriptionKh, /ជារបាយការណ៍របស់យោធាថៃ/u);
});

test("Matichon summary records the publisher's Dec 18 summary of Dec 17 events", () => {
  const article = readJsonl("data/news/2025-12.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.match(article.summary, /issued at 08:30 on December 18/u);
  assert.match(article.summary, /fighting during December 17/u);
  assert.match(article.summary, /Ban Sakon Phatthana/u);
  assert.match(article.summary, /Ban Mai Dong Yen/u);
});
