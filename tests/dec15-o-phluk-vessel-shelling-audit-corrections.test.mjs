import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7fq4c97qqd5egw601e5v8h35812r1s";
const evidenceId = "jn74c7e0pz58md6vfkgvwndm4s7xd3w1";

test("O Phluk Damrei vessel-shelling claim is anchored to the first reported Dec 15 strike", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-15");
  assert.equal(event.timeOfDay, "20:27");
  assert.match(event.description, /20:27 on December 15/u);
  assert.match(event.description, /22:33/u);
  assert.match(event.description, /00:14 on December 16/u);
});

test("timeline does not turn Cambodia's allegation into an independently verified naval attack", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.title, /Cambodian Defence Ministry Says/u);
  assert.match(event.description, /This is a Cambodian government account/u);
  assert.match(event.description, /does not independently verify/u);
  assert.doesNotMatch(event.title, /Coast/u);
  assert.doesNotMatch(event.description, /maritime hostilities/u);
});

test("Thai and Khmer copy preserve the same timing and attribution", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.descriptionTh, /20:27/u);
  assert.match(event.descriptionTh, /คำกล่าวของรัฐบาลกัมพูชา/u);
  assert.match(event.descriptionKh, /20:27/u);
  assert.match(event.descriptionKh, /ការរាយការណ៍របស់រដ្ឋាភិបាលកម្ពុជា/u);
});

test("evidence summary records the ministry statement as one attributed source chain", () => {
  const article = readJsonl("data/news/2025-12.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.equal(article.category, "military");
  assert.equal(article.provenanceId, "cambodia-mnd-o-phluk-damrei-vessel-shelling-2025-12-16");
  assert.match(article.summary, /20:27 on December 15/u);
  assert.match(article.summary, /not independent verification/u);
});
