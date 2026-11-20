import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7dz2x6d1nsz5vcd8zpjqbw0h813ga3";
const aphrId = "44763813010ff5a4726beb8a24bce624";
const cambodianessId = "k97812dey6616gsmz3j5v18gmh7xaf7z";
const provenanceId = "aphr-thailand-cambodia-statement-2025-12-15";

test("December 15 APHR milestone is date-only and does not imply an ASEAN institutional declaration", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-15");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /^APHR Calls/u);
  assert.match(event.description, /a regional network of parliamentarians/u);
  assert.match(event.description, /not an official ASEAN declaration/u);
});

test("APHR displacement range and legal assessment remain attributed", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /330,000-600,000 displaced people/u);
  assert.match(event.description, /APHR cited/u);
  assert.match(event.description, /APHR's assessments/u);
  assert.deepEqual(event.evidenceIds, [aphrId, cambodianessId]);
});

test("Thai and Khmer copy preserve APHR identity, range, and non-ASEAN distinction", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.descriptionTh, /APHR/u);
  assert.match(event.descriptionTh, /330,000-600,000/u);
  assert.match(event.descriptionTh, /ไม่ใช่คำประกาศอย่างเป็นทางการของอาเซียน/u);
  assert.match(event.descriptionKh, /APHR/u);
  assert.match(event.descriptionKh, /330,000/u);
  assert.match(event.descriptionKh, /600,000/u);
  assert.match(event.descriptionKh, /មិនមែនជាសេចក្តីប្រកាសផ្លូវការរបស់អាស៊ានទេ/u);
});

test("primary APHR statement and Cambodianess report share statement provenance", () => {
  const articles = readJsonl("data/news/2025-12.jsonl");
  const aphr = articles.find((row) => row.id === aphrId);
  const cambodianess = articles.find((row) => row.id === cambodianessId);
  assert.ok(aphr);
  assert.ok(cambodianess);
  assert.equal(aphr.provenanceId, provenanceId);
  assert.equal(cambodianess.provenanceId, provenanceId);
  assert.equal(aphr.credibility, 100);
  assert.match(aphr.summary, /regional network of parliamentarians/u);
});
