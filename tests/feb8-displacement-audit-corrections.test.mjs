import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7ejvq3jgf0p8m45bj0j4yrxx813prj";
const odcId = "acf9fc66ae32abc0daa48f5721ce9b95";
const ministryId = "c3a887b037fbf72346b0ab0abe094863";
const dapIndexId = "jn7bvq2cgyxgdk8z08m41e6zsn812atj";
const dapMismatchId = "jn7fy8z39gfkrrdxyv402yk58s80vvg5";
const provenanceId = "cambodia-moi-displacement-update-2026-02-08";

test("Feb 8 displacement milestone is date-only and cites captured ministry-mirror evidence", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-02-08");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [odcId]);
});

test("Feb 8 wording keeps supported totals and removes conflated demographics", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /86,447/u);
  assert.match(event.description, /more than 640,000/u);
  assert.match(event.description, /unable to return/u);
  assert.doesNotMatch(event.description, /28,012|28,000|13%/u);
  assert.match(event.description, /does not provide the child count/u);
});

test("Thai and Khmer copies preserve the supported figures and evidence boundary", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  for (const value of ["8", "86,447", "640,000"]) {
    assert.ok(event.descriptionTh.includes(value), "Thai " + value);
    assert.ok(event.descriptionKh.includes(value), "Khmer " + value);
  }
  assert.doesNotMatch(event.descriptionTh, /28,012|28,000|13%/u);
  assert.doesNotMatch(event.descriptionKh, /28,012|28,000|13%/u);
});

test("official and mirror rows share provenance while bad DAP identities are repaired", () => {
  const news = readJsonl("data/news/2026-02.jsonl");
  const odc = news.find((row) => row.id === odcId);
  const ministry = news.find((row) => row.id === ministryId);
  const dapIndex = news.find((row) => row.id === dapIndexId);
  const dapMismatch = news.find((row) => row.id === dapMismatchId);
  assert.equal(odc.provenanceId, provenanceId);
  assert.equal(ministry.provenanceId, provenanceId);
  assert.equal(dapIndex.status, "unverified");
  assert.equal(dapIndex.credibility, 40);
  assert.match(dapIndex.summary, /does not contain/u);
  assert.equal(dapMismatch.category, "diplomatic");
  assert.match(dapMismatch.titleEn, /Pen Bona/u);
  assert.doesNotMatch(dapMismatch.summary, /86,271 displaced|86,447/u);
});
