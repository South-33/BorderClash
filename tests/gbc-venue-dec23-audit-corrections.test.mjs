import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Dec 23 GBC row records Thailand's venue decision without importing later bargaining", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const event = timeline.find((row) => row.id === "ks7c437etejk8n83y2dkx7ps958135kn");
  const news = readJsonl("data/news/2025-12.jsonl");

  assert.ok(event);
  assert.equal(event.date, "2025-12-23");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Rejects GBC Venue Move/u);
  assert.match(event.description, /rejected Cambodia's request/u);
  assert.match(event.description, /December 24 to 26/u);
  assert.doesNotMatch(event.description, /three non-negotiable|demining cooperation|immediate ceasefire conditions/iu);
  assert.deepEqual(event.evidenceIds, [
    "8243f23663d573c41178ac2b59a282a1",
    "js75e8868hbrfqd8xaqcj150617xttnk",
  ]);

  const hindu = news.find((row) => row.id === "js75e8868hbrfqd8xaqcj150617xttnk");
  const nation = news.find((row) => row.id === "8243f23663d573c41178ac2b59a282a1");
  assert.equal(hindu?.mediaEnvironment, "international");
  assert.equal(nation?.mediaEnvironment, "thailand-domestic");
  assert.match(nation?.summary || "", /On December 23/u);
});
