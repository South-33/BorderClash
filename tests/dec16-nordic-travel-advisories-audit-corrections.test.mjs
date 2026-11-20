import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7fyc5fzmpp3kwe57gyhw3a09812rdy";
const evidenceId = "k973hdrnqxszxj20h5p522pvsn7xegge";

test("Nordic advisory milestone uses the date Denmark joined Sweden's earlier warning", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-16");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(event.category, "humanitarian");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("advisory chronology and island scope match the captured report", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /December 12/u);
  assert.match(event.description, /December 16/u);
  assert.match(event.description, /50 kilometres/u);
  assert.match(event.description, /Koh Chang, Koh Kood and Koh Mak/u);
  assert.match(event.description, /does not establish a broader quantified tourism loss/u);
  assert.doesNotMatch(event.description, /striking a blow/u);
});

test("Thai and Khmer copies preserve both dates and evidence limitation", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  for (const value of ["12", "16", "50"]) {
    assert.ok(event.descriptionTh.includes(value), "Thai " + value);
    assert.ok(event.descriptionKh.includes(value), "Khmer " + value);
  }
  assert.match(event.descriptionTh, /ไม่ได้ยืนยัน/u);
  assert.match(event.descriptionKh, /មិនបានបញ្ជាក់/u);
});
