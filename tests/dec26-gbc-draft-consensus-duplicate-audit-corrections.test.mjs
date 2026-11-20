import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const survivorId = "ks7ddwpv8ad0bszpr99y4qat31812x0t";
const mergedId = "ks7d7zbdq6ft8mt9hek95mwq9h8136tn";
const akpId = "02f25386436faaa3ee49b18c6dbe9f6b";

test("December 26 GBC outcome is one 22:50 draft-consensus event", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const event = timeline.find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-26");
  assert.equal(event.timeOfDay, "22:50");
  assert.equal(timeline.some((row) => row.id === mergedId), false);
  assert.match(event.title, /Reach Consensus on Draft Joint Statement/u);
  assert.match(event.description, /reached consensus at 22:50/u);
  assert.match(event.description, /agreement on a draft, not yet the signed ceasefire/u);
  assert.ok(event.evidenceIds.includes(akpId));
});

test("all languages distinguish the Dec 26 draft from the Dec 27 signed ceasefire", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  for (const field of ["description", "descriptionTh", "descriptionKh"]) {
    assert.match(event[field], /22:50/u);
    assert.match(event[field], /27/u);
  }
  assert.match(event.descriptionTh, /ยังไม่ใช่ข้อตกลงหยุดยิงที่ลงนามแล้ว/u);
  assert.match(event.descriptionKh, /មិនមែនជាបទឈប់បាញ់ដែលបានចុះហត្ថលេខារួចទេ/u);
});

test("AKP evidence preserves the exact consensus time and draft scope", () => {
  const article = readJsonl("data/news/2025-12.jsonl").find((row) => row.id === akpId);
  assert.ok(article);
  assert.equal(article.provenanceId, "cambodia-mod-dec26-gbc-draft-consensus");
  assert.equal(article.credibility, 80);
  assert.match(article.summary, /22:50 on December 26/u);
  assert.match(article.summary, /draft Joint Statement/u);
});
