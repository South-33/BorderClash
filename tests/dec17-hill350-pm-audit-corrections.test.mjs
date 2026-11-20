import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks795mj8jr0eknhwak7k5zn6d5813v5g";
const channel8Id = "c857537032f2b792bf6b5a4f80627d45";
const dailyNewsId = "js7eqwgchfwmxh2xty67cvap657xfcrk";
const provenanceId = "anutin-hill-350-interview-2025-12-17";

test("Dec 17 Hill 350 row is date-only and grounded in captured Channel 8 reporting", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-17");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(event.category, "political");
  assert.deepEqual(event.evidenceIds, [channel8Id]);
});

test("row records Anutin's statement without importing unrelated battlefield claims", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /Anutin Charnvirakul/u);
  assert.match(event.description, /must.*Hill 350/u);
  assert.match(event.description, /Cambodia should negotiate/u);
  assert.match(event.description, /political statement of intent/u);
  assert.match(event.description, /claimed control on December 20/u);
  assert.doesNotMatch(event.description, /water shortages|FPV|suicide drones|heavy mortar/u);
});

test("Thai and Khmer copies preserve date, two deaths, negotiation, and chronology boundary", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  for (const value of ["17", "350", "2", "20"]) {
    assert.ok(event.descriptionTh.includes(value), "Thai " + value);
    assert.ok(event.descriptionKh.includes(value), "Khmer " + value);
  }
  assert.match(event.descriptionTh, /ควรเจรจา/u);
  assert.match(event.descriptionKh, /គួរចរចា/u);
  assert.match(event.descriptionTh, /ไม่ใช่หลักฐาน/u);
  assert.match(event.descriptionKh, /មិនមែនជាភស្តុតាង/u);
});

test("Channel 8 is captured-event evidence and Daily News shares the same interview provenance", () => {
  const news = readJsonl("data/news/2025-12.jsonl");
  const channel8 = news.find((row) => row.id === channel8Id);
  const dailyNews = news.find((row) => row.id === dailyNewsId);
  assert.ok(channel8);
  assert.ok(dailyNews);
  assert.equal(channel8.source, "Channel 8");
  assert.equal(channel8.publishedAt, 1765962960000);
  assert.equal(channel8.provenanceId, provenanceId);
  assert.equal(dailyNews.provenanceId, provenanceId);
  assert.match(channel8.summary, /declined to discuss operational details/u);
});
