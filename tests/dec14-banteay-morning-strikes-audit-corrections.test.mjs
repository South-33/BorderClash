import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks753ejpmehada539rfrsrqman81225v";
const ktId = "jn76q1cn7cqpn1p6xcwp4126t57x8k40";
const cambojaId = "516b915401cfa8bbd4efd3c9c2dc3f64";
const dapId = "jna169010ab18b8e51e60464d3244dac";
const provenanceId = "cambodia-mod-dec14-5th-region-morning";

test("December 14 Banteay Meanchey milestone uses the supported 06:30 start", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-14");
  assert.equal(event.timeOfDay, "06:30");
  assert.match(event.title, /Cambodian Defence Ministry Reports/u);
  assert.match(event.description, /Boeung Trakuan at 6:30 a\.m\./u);
  assert.match(event.description, /10:36 a\.m\./u);
  assert.match(event.description, /11:20 a\.m\./u);
});

test("military claims remain attributed and unsupported ICC wording is removed", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /Cambodian official claims/u);
  assert.match(event.description, /do not independently verify them/u);
  assert.doesNotMatch(event.description, /ICC/u);
  assert.deepEqual(event.evidenceIds, [ktId, cambojaId]);
  assert.equal(event.evidenceIds.includes(dapId), false);
});

test("Thai and Khmer copy preserve the same times, actor, and attribution", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const value of ["6:30", "10:36", "11:20"]) {
    assert.match(event.descriptionTh, new RegExp(value, "u"));
    assert.match(event.descriptionKh, new RegExp(value, "u"));
  }
  assert.match(event.descriptionTh, /กระทรวงกลาโหมกัมพูชา/u);
  assert.match(event.descriptionTh, /ไม่ได้ยืนยันโดยอิสระ/u);
  assert.match(event.descriptionKh, /ក្រសួងការពារជាតិកម្ពុជា/u);
  assert.match(event.descriptionKh, /មិនបានផ្ទៀងផ្ទាត់វាដោយឯករាជ្យ/u);
});

test("Khmer Times and CamboJA share the Cambodian Defence Ministry update provenance", () => {
  const articles = readJsonl("data/news/2025-12.jsonl");
  const kt = articles.find((row) => row.id === ktId);
  const camboja = articles.find((row) => row.id === cambojaId);
  assert.ok(kt);
  assert.ok(camboja);
  assert.equal(kt.provenanceId, provenanceId);
  assert.equal(camboja.provenanceId, provenanceId);
  assert.match(camboja.summary, /6:30 a\.m\./u);
  assert.match(camboja.summary, /Cambodian ministry claims/u);
});
