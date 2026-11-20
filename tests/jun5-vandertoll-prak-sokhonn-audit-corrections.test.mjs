import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks72tnr1c9x0qvj49asqefpfvn887et7";
const kiripostId = "jn78gkrt8wbfsr4hpqdv08v13d886m7h";
const kptId = "67de33b57f477fa33ec4060313715319";

test("June 5 working lunch is date-only and keeps the documented peace-agreement agenda", () => {
  const timeline = readJsonl("data/timeline/2026-06.jsonl");
  const event = timeline.find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-06-05");
  assert.equal(event.timeOfDay ?? "", "");
  assert.match(event.title, /Prak Sokhonn Meets US Deputy Assistant Secretary Hunt VanderToll/u);
  assert.match(event.description, /working lunch/u);
  assert.match(event.description, /July 28 ceasefire/u);
  assert.match(event.description, /October 26, 2025 Kuala Lumpur Peace Agreement/u);
  assert.match(event.description, /ASEAN-U\.S\. cooperation/u);
  assert.doesNotMatch(event.description, /arbitration/u);
  assert.deepEqual(event.evidenceIds, [kiripostId, kptId]);
});

test("English, Thai, and Khmer preserve the actors and agreement dates", () => {
  const event = readJsonl("data/timeline/2026-06.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const field of ["description", "descriptionTh", "descriptionKh"]) {
    assert.match(event[field], /Hunt VanderToll|ฮันต์ แวนเดอร์ทอล/u);
    assert.match(event[field], /28/u);
    assert.match(event[field], /26/u);
    assert.match(event[field], /2025/u);
  }
});

test("MFA-derived reports share provenance and Kiripost uses its displayed publication time", () => {
  const articles = readJsonl("data/news/2026-06.jsonl");
  const kiripost = articles.find((row) => row.id === kiripostId);
  const kpt = articles.find((row) => row.id === kptId);
  assert.ok(kiripost);
  assert.ok(kpt);
  assert.equal(kiripost.publishedAt, Date.parse("2026-06-05T22:54:00Z"));
  assert.equal(kiripost.provenanceId, "cambodia-mfa-jun5-vandertoll-prak-sokhonn");
  assert.equal(kpt.provenanceId, "cambodia-mfa-jun5-vandertoll-prak-sokhonn");
  assert.match(kiripost.summary, /over lunch on June 5/u);
  assert.match(kiripost.summary, /gives no exact start time/u);
});
