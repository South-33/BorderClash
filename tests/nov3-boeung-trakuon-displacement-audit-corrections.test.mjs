import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks75b2cdffe97y8s9ew7h382x98hkca4";
const primaryId = "f373c798a14bcb50b88a7d802a18ef53";
const anadoluId = "k973y1pxxn5k8fd06tfgzj4eax8hjkkg";

test("November 3 displacement milestone uses exact figures without inventing a report time", () => {
  const event = readJsonl("data/timeline/2026-11.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-11-03");
  assert.equal(event.timeOfDay, "");
  assert.deepEqual(event.evidenceIds, [primaryId, anadoluId]);
  assert.match(event.description, /7,873 civilians from 1,869 families/u);
  assert.match(event.description, /including 1,847 children/u);
  assert.match(event.description, /Boeung Trakuon checkpoint/u);
  assert.match(event.description, /observation mission there at 08:45 that morning/u);
});

test("timeline attributes Cambodia's territorial claim and preserves Thailand's contrary position", () => {
  const event = readJsonl("data/timeline/2026-11.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /what it called unlawful occupation/u);
  assert.match(event.description, /Thailand has rejected similar allegations/u);
  assert.match(event.descriptionTh, /ฝ่ายไทยปฏิเสธข้อกล่าวหาลักษณะเดียวกัน/u);
  assert.match(event.descriptionKh, /ថៃបានបដិសេធការចោទប្រកាន់ស្រដៀងគ្នា/u);
  for (const text of [event.descriptionTh, event.descriptionKh]) {
    assert.match(text, /7,873/u);
    assert.match(text, /1,869/u);
    assert.match(text, /1,847/u);
    assert.doesNotMatch(text, /�/u);
  }
});

test("primary and derivative reports share one provenance chain", () => {
  const articles = readJsonl("data/news/2026-11.jsonl");
  const primary = articles.find((row) => row.id === primaryId);
  const anadolu = articles.find((row) => row.id === anadoluId);
  assert.ok(primary);
  assert.ok(anadolu);
  assert.equal(primary.provenanceId, "nov3-mod-boeung-trakuon-displacement");
  assert.equal(anadolu.provenanceId, primary.provenanceId);
  assert.equal(primary.credibility, 90);
  assert.match(primary.summary, /08:45/u);
  assert.match(primary.summary, /not the underlying territorial allegations/u);
  assert.match(anadolu.summary, /Thailand had rejected similar allegations/u);
});
