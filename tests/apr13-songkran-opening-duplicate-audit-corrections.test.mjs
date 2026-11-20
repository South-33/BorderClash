import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const survivorId = "ks737nyczsmvavjajejb9qxwv184v4e6";
const duplicateId = "ks71gwggpb5rec0f1tt9nafh3s852zke";
const evidenceId = "js780zxabetaezahzmby63vw4984rmep";

test("Songkran flashpoint wrappers collapse into one date-only April 13 event", () => {
  const timeline = readJsonl("data/timeline/2026-04.jsonl");
  const event = timeline.find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(event.date, "2026-04-13");
  assert.equal(event.timeOfDay ?? "", "");
  assert.equal(timeline.some((row) => row.id === duplicateId), false);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("the event preserves the temporary April 13-16 opening and safety limits", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  assert.match(event.description, /April 13–16/u);
  assert.match(event.description, /groups of 100/u);
  assert.match(event.description, /marked areas/u);
  assert.match(event.description, /temporary/u);
  assert.doesNotMatch(event.description, /08:00/u);
});

test("Ta Muen Thom remains closed in all language versions", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  assert.match(event.description, /Ta Muen Thom remained closed/u);
  assert.match(event.descriptionTh, /ปราสาทตาเมือนธมยังปิดอยู่/u);
  assert.match(event.descriptionKh, /ប្រាសាទ Ta Muen Thom នៅតែបិទ/u);
});

test("captured evidence summary reflects first-day temporary access", () => {
  const article = readJsonl("data/news/2026-04.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.match(article.summary, /April 13 was the first day/u);
  assert.match(article.summary, /April 13–16/u);
  assert.match(article.summary, /groups of 100/u);
});
