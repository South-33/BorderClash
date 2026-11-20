import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7a8fwvsv0rk3xxacde8cps5n8b6phk";
const primaryId = "379363c447392bfb39fdecbaf7c60977";
const analysisId = "k970cdw0zs4790pr0qe1wbc4td8b6fs6";

test("UNCLOS chair-extension milestone uses the primary July 17 briefing date and time", () => {
  const event = readJsonl("data/timeline/2026-07.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-07-17");
  assert.equal(event.timeOfDay, "14:00");
  assert.deepEqual(event.evidenceIds, [primaryId, analysisId]);
  assert.match(event.description, /14:00 briefing on July 17/u);
  assert.match(event.description, /from July 19 to August 14/u);
  assert.match(event.description, /following a proposal from the conciliators/u);
  assert.match(event.description, /not legally binding/u);
});

test("localized copy preserves the key dates, time, and scope disagreement", () => {
  const event = readJsonl("data/timeline/2026-07.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const text of [event.descriptionTh, event.descriptionKh]) {
    assert.match(text, /14:00/u);
    assert.match(text, /17/u);
    assert.match(text, /19/u);
    assert.match(text, /14/u);
    assert.doesNotMatch(text, /���|\?{3,}/u);
  }
});

test("canonical evidence includes the captured Thai MFA briefing and separate scope analysis", () => {
  const articles = readJsonl("data/news/2026-07.jsonl");
  const primary = articles.find((row) => row.id === primaryId);
  const analysis = articles.find((row) => row.id === analysisId);
  assert.ok(primary);
  assert.ok(analysis);
  assert.equal(primary.source, "Ministry of Foreign Affairs of Thailand");
  assert.equal(primary.status, "archived");
  assert.equal(primary.credibility, 90);
  assert.match(primary.summary, /14:00 weekly press briefing on July 17/u);
  assert.match(primary.summary, /from July 19 to August 14/u);
  assert.match(analysis.summary, /Thailand wanted maritime-boundary delimitation addressed first/u);
  assert.match(analysis.summary, /Cambodia wanted the process to facilitate both boundary settlement/u);
});
