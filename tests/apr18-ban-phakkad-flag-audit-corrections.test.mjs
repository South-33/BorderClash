import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7933fma9n8x0g4mcp0vet625858r79";
const evidenceId = "81e5dd15054a35a5f95c869484d4b559";

test("Ban Phakkad flag milestone is date-only and uses captured JS100 evidence", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-04-18");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.title, /found missing/ui);
});

test("responsibility for the missing flag remains unresolved", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /senior Cambodian officer denied involvement/u);
  assert.match(event.description, /continued investigating/u);
  assert.match(event.description, /does not establish who was responsible/u);
  assert.doesNotMatch(event.description, /provocation/u);
});

test("Thai and Khmer copies preserve date, denial and investigation boundary", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.ok(event.descriptionTh.includes("18"));
  assert.ok(event.descriptionKh.includes("18"));
  assert.match(event.descriptionTh, /ปฏิเสธ/u);
  assert.match(event.descriptionKh, /បដិសេធ/u);
  assert.match(event.descriptionTh, /ไม่ได้ยืนยัน/u);
  assert.match(event.descriptionKh, /មិនបានបញ្ជាក់/u);
});

test("JS100 row preserves the Navy attribution and incident date", () => {
  const article = readJsonl("data/news/2026-04.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.equal(article.source, "JS100");
  assert.match(article.summary, /April 18/u);
  assert.match(article.summary, /senior Cambodian officer denied involvement/ui);
  assert.match(article.summary, /investigating/u);
});
