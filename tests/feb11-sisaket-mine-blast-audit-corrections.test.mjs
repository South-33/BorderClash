import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks77r0whkdytcpk4aedzek6avd813bwf";
const bloombergId = "k97ekw18d9et6qr1mt5fgkc41n8106by";
const thairathId = "3ff1f5cc5313759f286274d00c157671";
const akpId = "c86906a89ea761bfc80c60e75efac761";
const provenanceId = "thai-army-kantharalak-mine-2026-02-11";

test("February 11 mine-blast event does not invent an exact blast time", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-02-11");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /Kantharalak district, Si Sa Ket/u);
  assert.doesNotMatch(event.description, /16:40/u);
  assert.match(event.description, /two other soldiers had minor injuries/u);
  assert.doesNotMatch(event.description, /Chong Sa-ngam/u);
});

test("mine age remains an attributed preliminary assessment, not established origin", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /Thai preliminary reports said/u);
  assert.match(event.description, /Cambodia's Mine Action and Victim Assistance Authority separately said/u);
  assert.match(event.description, /Neither side's statement established the mine's origin or when it was emplaced/u);
  assert.deepEqual(event.evidenceIds, [bloombergId, thairathId, akpId]);
});

test("Thai and Khmer copy preserve time, casualty count, and uncertainty", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.doesNotMatch(event.descriptionTh, /16:40/u);
  assert.match(event.descriptionTh, /อีก 2 นายบาดเจ็บเล็กน้อย/u);
  assert.match(event.descriptionTh, /ยังไม่ได้ยืนยันที่มาของทุ่นระเบิด/u);
  assert.doesNotMatch(event.descriptionKh, /16:40/u);
  assert.match(event.descriptionKh, /2 នាក់ទៀតរងរបួសស្រាល/u);
  assert.match(event.descriptionKh, /មិនបានបញ្ជាក់ប្រភពដើមរបស់មីន/u);
});

test("Thai Army reports share provenance while Cambodia's CMAA statement remains separate", () => {
  const articles = readJsonl("data/news/2026-02.jsonl");
  const bloomberg = articles.find((row) => row.id === bloombergId);
  const thairath = articles.find((row) => row.id === thairathId);
  const akp = articles.find((row) => row.id === akpId);
  assert.ok(bloomberg);
  assert.ok(thairath);
  assert.ok(akp);
  assert.equal(bloomberg.provenanceId, provenanceId);
  assert.equal(thairath.provenanceId, provenanceId);
  assert.notEqual(akp.provenanceId, provenanceId);
  assert.match(thairath.summary, /16:40/u);
  assert.match(akp.summary, /highly likely to be a legacy device/u);
});
