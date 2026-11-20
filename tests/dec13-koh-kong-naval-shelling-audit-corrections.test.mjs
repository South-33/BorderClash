import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7ccjrvg04qe4z4gmedn3m4r9813fs9";
const articleId = "jn74xwpap7fzwv1d7bebbbp6897x7dxh";
const unrelatedThaiRathId = "jne11407e493bc2d2b7b1355adb1afce";

test("Koh Kong naval shelling remains at directly supported 02:00 and is attributed", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-13");
  assert.equal(event.timeOfDay, "02:00");
  assert.match(event.title, /^Cambodian Defence Ministry Says/u);
  assert.match(event.description, /fired 20 artillery shells/u);
  assert.match(event.description, /Koh Yor Beach/u);
  assert.match(event.description, /Bak Klong Pagoda/u);
  assert.match(event.description, /does not independently verify/u);
  assert.deepEqual(event.evidenceIds, [articleId]);
  assert.equal(event.evidenceIds.includes(unrelatedThaiRathId), false);
  assert.doesNotMatch(event.description, /significant widening of the front/u);
});

test("Khmer Times stored summary exposes the directly captured 02:00 support", () => {
  const article = readJsonl("data/news/2025-12.jsonl").find((row) => row.id === articleId);
  assert.ok(article);
  assert.match(article.summary, /Ministry of National Defence spokesperson/u);
  assert.match(article.summary, /02:00 on December 13/u);
  assert.match(article.summary, /20 artillery shells/u);
  assert.match(article.summary, /no further shelling reported between 02:00 and 08:00/u);
});
