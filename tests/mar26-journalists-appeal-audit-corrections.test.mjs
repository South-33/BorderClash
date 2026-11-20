import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7575fht4r6s3v64ysy71mtyd83q0hs";
const standardId = "k971gzj14kwmxjtc0kfbeh4yad83q6g2";
const straitsId = "k97fb4gkm4k8ym2249s2hm294583sv07";
const provenanceId = "afp-mar26-cambodia-journalists-appeal";

test("March 26 appeal ruling is date-only and preserves the December conviction chronology", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-03-26");
  assert.equal(event.timeOfDay ?? "", "");
  assert.match(event.title, /Battambang Appeal Court Upholds 14-Year Sentences/u);
  assert.match(event.description, /On March 26/u);
  assert.match(event.description, /December 17, 2025/u);
  assert.doesNotMatch(event.description, /10:00/u);
});

test("appeal copy consistently identifies the journalists and Ta Krabei Temple", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const field of ["description", "descriptionTh", "descriptionKh"]) {
    assert.match(event[field], /Phorn Sopheap/u);
    assert.match(event[field], /Pheap Pheara/u);
  }
  assert.match(event.description, /Ta Krabei Temple/u);
  assert.match(event.descriptionTh, /ปราสาทตาควาย/u);
  assert.match(event.descriptionKh, /ប្រាសាទតាក្របី/u);
  assert.doesNotMatch(event.descriptionKh, /ប្រាសាទតាខ្មៅ/u);
});

test("the two March reports are one AFP evidence chain", () => {
  const articles = readJsonl("data/news/2026-03.jsonl");
  const standard = articles.find((row) => row.id === standardId);
  const straits = articles.find((row) => row.id === straitsId);
  assert.ok(standard);
  assert.ok(straits);
  assert.equal(standard.provenanceId, provenanceId);
  assert.equal(straits.provenanceId, provenanceId);
  assert.match(standard.source, /AFP/u);
  assert.match(standard.summary, /March 26/u);
  assert.match(straits.summary, /March 26/u);
});
