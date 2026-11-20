import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7ck5k0bwsfq3139dn3qhvqbn813mnj";
const mfaId = "1d6fd3117487622b594f6fc0955c27e9";
const xinhuaId = "k979gjxxhf7wrd00aw6c9q7td97x8v2m";
const provenanceId = "thai-mfa-press-briefing-2025-12-13";

test("December 13 Trump-remarks milestone uses the official 15:00 briefing time", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-13");
  assert.equal(event.timeOfDay, "15:00");
  assert.match(event.title, /Thai Foreign Minister Rejects Trump/u);
  assert.doesNotMatch(event.description, /19:00/u);
  assert.deepEqual(event.evidenceIds, [mfaId, xinhuaId]);
});

test("all language versions identify Sihasak and keep disputed claims attributed", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /Sihasak Phuangketkeow/u);
  assert.match(event.descriptionTh, /สีหศักดิ์ พวงเกตุแก้ว/u);
  assert.match(event.descriptionKh, /Sihasak Phuangketkeow/u);
  assert.doesNotMatch(event.descriptionTh, /มาริษ เสงี่ยมพงษ์/u);
  assert.doesNotMatch(event.descriptionKh, /Maris Sangiampongsa/u);
  assert.match(event.description, /Thailand's stated position/u);
  assert.match(event.descriptionTh, /จุดยืนที่ฝ่ายไทยระบุ/u);
  assert.match(event.descriptionKh, /ជំហរដែលភាគីថៃបានលើកឡើង/u);
});

test("official MFA and Xinhua reports share the same briefing provenance", () => {
  const articles = readJsonl("data/news/2025-12.jsonl");
  const mfa = articles.find((row) => row.id === mfaId);
  const xinhua = articles.find((row) => row.id === xinhuaId);
  assert.ok(mfa);
  assert.ok(xinhua);
  assert.equal(mfa.provenanceId, provenanceId);
  assert.equal(xinhua.provenanceId, provenanceId);
  assert.equal(mfa.credibility, 100);
  assert.match(xinhua.source, /Xinhua/u);
  assert.equal(xinhua.publishedAt, 1765688520000);
});
