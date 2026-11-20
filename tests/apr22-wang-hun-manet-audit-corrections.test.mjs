import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks70mj2rvm357nmryrabk5z6jd85dcw4";
const officialId = "5bcea2b7464caf42298b6b1274e42bfb";
const rthkId = "k976w25bm1ya1ntkqf60nq0zzd85c71c";
const provenanceId = "china-mfa-hun-manet-wang-2026-04-22";

test("Apr 22 Wang-Hun Manet row separates anti-scam and Cambodia-Thailand dialogue claims", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-04-22");
  assert.equal(event.timeOfDay, "");
  assert.match(event.description, /Hun Manet met Chinese Foreign Minister Wang Yi and Defence Minister Dong Jun/u);
  assert.match(event.description, /eradicate cross-border online gambling and telecom fraud/u);
  assert.match(event.description, /platforms for renewed exchanges and direct dialogue/u);
  assert.doesNotMatch(event.description, /pretext for conflict|normalize relations/u);
  assert.deepEqual(event.evidenceIds, [officialId]);
});

test("Apr 22 Wang-Hun Manet localizations preserve actors, attribution, and separate claims", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.titleTh + event.descriptionTh, /[\u0E00-\u0E7F]/u);
  assert.match(event.titleKh + event.descriptionKh, /[\u1780-\u17FF]/u);
  for (const text of [event.descriptionTh, event.descriptionKh]) {
    assert.match(text, /22/u);
    assert.match(text, /Dong Jun/u);
    assert.doesNotMatch(text, /\?|�/u);
  }
});

test("official China MFA and RTHK reproduction share the same statement provenance", () => {
  const news = readJsonl("data/news/2026-04.jsonl");
  const official = news.find((row) => row.id === officialId);
  const rthk = news.find((row) => row.id === rthkId);
  assert.ok(official);
  assert.ok(rthk);
  assert.equal(official.source, "Ministry of Foreign Affairs of China");
  assert.equal(official.credibility, 100);
  assert.equal(official.provenanceId, provenanceId);
  assert.equal(rthk.source, "RTHK (AFP/Xinhua)");
  assert.equal(rthk.provenanceId, provenanceId);
  assert.match(rthk.summary, /Chinese Foreign Ministry statement/u);
});
