import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("May 30 Cambodian construction protest is one attributed milestone, not publication-date duplicates", () => {
  const timeline = readJsonl("data/timeline/2026-05.jsonl");
  const event = timeline.find((row) => row.id === "ks70b4n904yrk6vztavhexe98987sy91");
  const news = readJsonl("data/news/2026-05.jsonl");
  const primary = news.find((row) => row.id === "3f709888dd55a52af0f713f6f0c3f308");
  const may31 = news.find((row) => row.id === "k973381gvgmr5yp4n3a2fjmah987rysj");
  const june1 = news.find((row) => row.id === "jn73x18j7h8pv2xm4xn0vq3ceh87r5vr");

  assert.ok(event);
  assert.ok(primary);
  assert.ok(may31);
  assert.ok(june1);
  assert.equal(event.date, "2026-05-30");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /Foreign Ministry issued a press release protesting/u);
  assert.match(event.description, /does not independently establish sovereignty/u);
  assert.deepEqual(event.evidenceIds, [primary.id, may31.id, june1.id]);
  assert.equal(timeline.some((row) => row.id === "ks75vj8yx5hwsdwej2tqgbc0f187rewe"), false);
  assert.equal(timeline.some((row) => row.id === "ks778sxqyg7jjv1vjk094n4zkx87s590"), false);
  assert.equal(primary.provenanceId, "cambodia-mfa-may30-construction-protest");
  assert.equal(may31.provenanceId, primary.provenanceId);
  assert.equal(june1.provenanceId, primary.provenanceId);
  assert.equal(new Date(primary.publishedAt + 7 * 60 * 60 * 1000).toISOString().slice(0, 10), "2026-05-30");
  assert.equal(new Date(june1.publishedAt + 7 * 60 * 60 * 1000).toISOString().slice(0, 10), "2026-06-01");
});
