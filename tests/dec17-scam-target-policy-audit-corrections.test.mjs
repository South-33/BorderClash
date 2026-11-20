import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks74hpbxwk2xd6g05ckp8ezc01813rd6";
const prdId = "20764822c6c1f0cd854377a5bf267eea";
const oldTv5Id = "js70dg8eab3ak6v1r45mm6df7d7xfde9";

test("Dec 17 row is the supported 16:00 Joint Press Center clarification", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-17");
  assert.equal(event.timeOfDay, "16:00");
  assert.match(event.title, /Scam Networks Are Not Direct Military Targets/u);
  assert.match(event.description, /suppressing scam networks was not a direct objective/u);
  assert.deepEqual(event.evidenceIds, [prdId]);
  assert.equal(event.evidenceIds.includes(oldTv5Id), false);
});

test("row no longer conflates retrospective airstrike reporting with Ban Sam Lang mines", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.doesNotMatch(event.description, /Ban Sam Lang/u);
  assert.doesNotMatch(event.description, /modified landmines/u);
  assert.doesNotMatch(event.title, /Navy Blockades/u);
  assert.match(event.description, /Thailand's stated policy and position/u);
  assert.match(event.description, /not independent verification/u);
});

test("Thai and Khmer preserve time, legal framing, and attribution", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.ok(event.descriptionTh.includes("16:00"));
  assert.ok(event.descriptionKh.includes("16:00"));
  assert.match(event.descriptionTh, /กฎหมายมนุษยธรรมระหว่างประเทศ/u);
  assert.match(event.descriptionKh, /ច្បាប់មនុស្សធម៌អន្តរជាតិ/u);
  assert.match(event.descriptionTh, /ไม่ใช่การยืนยันโดยอิสระ/u);
  assert.match(event.descriptionKh, /មិនមែនជាការផ្ទៀងផ្ទាត់ដោយឯករាជ្យ/u);
});

test("PRD evidence records the exact Joint Press Center time and policy", () => {
  const article = readJsonl("data/news/2025-12.jsonl").find((row) => row.id === prdId);
  assert.ok(article);
  assert.equal(article.publishedAt, 1765962000000);
  assert.equal(article.credibility, 90);
  assert.match(article.summary, /December 17 at 16:00/u);
  assert.match(article.summary, /scam networks were not a direct military target/u);
});
