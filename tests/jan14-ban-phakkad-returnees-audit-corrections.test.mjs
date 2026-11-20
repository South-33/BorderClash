import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks73mr2m3h6kjrh3kzj11ydbzd81353b";
const navyId = "js72bv1mrxagdqz7kawnrf5sk57z742q";
const pptvId = "d85cfa8ba0d889c115cc9b1db0a2c246";

test("Jan 14 Ban Phakkad return is date-only because contemporaneous reports differ", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-01-14");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [navyId, pptvId]);
  assert.match(event.description, /published accounts differ/u);
});

test("milestone uses the Royal Thai Navy's received count rather than the planned group count", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === eventId);
  assert.match(event.title, /28 Thai Returnees/u);
  assert.match(event.description, /return of 28 Thai nationals/u);
  assert.match(event.description, /PPTV report described a 29-person assistance group/u);
  assert.match(event.description, /does not preserve an exact event time/u);
});

test("Thai and Khmer copies preserve the 28-versus-29 discrepancy", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === eventId);
  for (const value of ["28", "29", "14"]) {
    assert.ok(event.descriptionTh.includes(value), "Thai " + value);
    assert.ok(event.descriptionKh.includes(value), "Khmer " + value);
  }
  assert.match(event.descriptionTh, /ความแตกต่างกัน/u);
  assert.match(event.descriptionKh, /ខុសគ្នា/u);
});

test("evidence registry preserves the two distinct contemporaneous accounts", () => {
  const news = readJsonl("data/news/2026-01.jsonl");
  const navy = news.find((row) => row.id === navyId);
  const pptv = news.find((row) => row.id === pptvId);
  assert.ok(navy);
  assert.ok(pptv);
  assert.equal(navy.credibility, 60);
  assert.equal(pptv.credibility, 60);
  assert.match(navy.summary, /28 Thai nationals/u);
  assert.match(pptv.summary, /29 Thai nationals/u);
  assert.notEqual(navy.provenanceId, pptv.provenanceId);
});
