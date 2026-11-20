import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks752118bf1xm1kzmsssqa1xs181fbpw";
const evidenceId = "jn71qp9hceas27xv11khe6h0fh81e3mc";

test("Feb 19 displacement snapshot uses the ministry's 06:00 reporting cutoff", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-02-19");
  assert.equal(event.timeOfDay, "06:00");
  assert.match(event.title, /70,516 Still Unable to Return Home/u);
  assert.match(event.description, /06:00 on February 18 to 06:00 on February 19/u);
  assert.doesNotMatch(event.description, /10:00/u);
});

test("snapshot preserves exact return and demographic counts", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const value of ["1,434", "580,000", "89%", "640,000", "70,516", "37,165", "24,924"]) {
    assert.match(event.description, new RegExp(value.replace("%", "%"), "u"));
  }
  assert.match(event.description, /including 37,165 women and 24,924 children/u);
});

test("Cambodian allegations are separated from the displacement count and not asserted as universal causes", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /ministry separately repeated Cambodian allegations/u);
  assert.match(event.description, /Cambodia's account rather than independently established causes/u);
  assert.doesNotMatch(event.description, /due to ongoing border instability/u);
});

test("English, Thai and Khmer preserve the cutoff and key counts", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const field of ["description", "descriptionTh", "descriptionKh"]) {
    for (const value of ["06:00", "1,434", "70,516", "37,165", "24,924"]) {
      assert.match(event[field], new RegExp(value.replace(":", ":"), "u"));
    }
  }
  assert.match(event.descriptionTh, /เป็นคำกล่าวของฝ่ายกัมพูชา/u);
  assert.match(event.descriptionKh, /ជាការរៀបរាប់របស់កម្ពុជា/u);
});

test("DAP evidence summary records the same reporting window and provenance", () => {
  const article = readJsonl("data/news/2026-02.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.equal(article.provenanceId, "cambodia-interior-displacement-2026-02-19");
  assert.match(article.summary, /06:00 on February 18 to 06:00 on February 19/u);
  assert.match(article.summary, /1,434 more displaced people returned/u);
  assert.match(article.summary, /70,516 remained unable to return/u);
  assert.match(article.summary, /37,165 women and 24,924 children/u);
});
