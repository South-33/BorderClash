import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const survivorId = "ks71sa0m5w25s8pg5931vfp1md813nb1";
const jan3ConflationId = "ks7f7g5zg2x71wzxcnd46ep2t5812a0n";
const genericJan6Id = "ks7751k8byc8hmc5vhcbvg7305858pmf";
const thaiMfaId = "f0f180a344dd2410016febe239c719f8";
const rteId = "86b3f5de6a837484a9b00639ea6700c9";
const akpId = "jn76cdxqzwbmd8y7te1jec8aed7yprnz";
const cgspId = "k97c40hprknbc6j9ncrj3f9q017yvngm";

test("Jan 6 Chong Bok/Mom Bei dispute is one date-only event", () => {
  const timeline = readJsonl("data/timeline/2026-01.jsonl");
  const event = timeline.find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(event.date, "2026-01-06");
  assert.equal(event.timeOfDay ?? "", "");
  assert.equal(timeline.some((row) => row.id === jan3ConflationId), false);
  assert.equal(timeline.some((row) => row.id === genericJan6Id), false);
  assert.deepEqual(event.evidenceIds, [thaiMfaId, rteId, akpId]);
});

test("survivor preserves the competing Thai and Cambodian accounts without inventing one common exact time", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  assert.match(event.description, /Thailand said Cambodian forces fired into the Chong Bok area/u);
  assert.match(event.description, /Thailand did not retaliate/u);
  assert.match(event.description, /Cambodia's Defence Ministry gave a different account/u);
  assert.match(event.description, /07:27/u);
  assert.match(event.description, /does not establish one common exact event time/u);
});

test("English, Thai and Khmer keep the attribution and date-only precision boundary", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  for (const field of ["description", "descriptionTh", "descriptionKh"]) {
    assert.match(event[field], /07:27/u);
  }
  assert.match(event.descriptionTh, /ไทยระบุ/u);
  assert.match(event.descriptionTh, /กระทรวงกลาโหมกัมพูชาให้ข้อมูลต่างออกไป/u);
  assert.match(event.descriptionKh, /ថៃបាននិយាយ/u);
  assert.match(event.descriptionKh, /ក្រសួងការពារជាតិកម្ពុជាបានផ្តល់ការរៀបរាប់ខុសគ្នា/u);
});

test("the Jan 3 Boeung Trakoun photo caption is not treated as the casualty date", () => {
  const articles = readJsonl("data/news/2026-01.jsonl");
  const cgsp = articles.find((row) => row.id === cgspId);
  const rte = articles.find((row) => row.id === rteId);
  assert.ok(cgsp);
  assert.ok(rte);
  assert.match(cgsp.summary, /photo caption separately identifies Boeung Trakoun village.*January 3/u);
  assert.match(cgsp.summary, /does not establish.*wounded-Thai-soldier incident.*January 3/u);
  assert.match(rte.summary, /image caption separately identifies a Boeung Trakoun photo from January 3/u);
  assert.match(rte.summary, /not the date of the wounded-Thai-soldier incident/u);
});

test("reviewable bilateral and independent evidence is retained", () => {
  const articles = readJsonl("data/news/2026-01.jsonl");
  const thaiMfa = articles.find((row) => row.id === thaiMfaId);
  const rte = articles.find((row) => row.id === rteId);
  const akp = articles.find((row) => row.id === akpId);
  assert.ok(thaiMfa);
  assert.ok(rte);
  assert.ok(akp);
  assert.equal(thaiMfa.provenanceId, "thai-mfa-jan6-chong-bok-firing-statement");
  assert.equal(rte.provenanceId, "afp-jan6-thai-cambodia-mortar-incident");
  assert.match(thaiMfa.summary, /did not retaliate/u);
  assert.match(rte.summary, /while Cambodia said/u);
});
