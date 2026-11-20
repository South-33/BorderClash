import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7de20q4bvy3akm7tyzc75rbn85hh3z";
const reutersId = "k97ekba8wxcfvshpqrvk1dd7ed85hej8";
const nationId = "k97ejhk1yf8t923aage6nakpe585hsc8";
const khmerTimesId = "jn7cbtkta4eqyjx1q4qr5nq8eh85ga8y";
const provenanceId = "reuters-wang-anutin-bangkok-2026-04-24";

test("Apr 24 Wang-Anutin meeting is date-only and not mislabeled as peace talks", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-04-24");
  assert.equal(event.timeOfDay, "");
  assert.match(event.title, /Wang Yi Meets Anutin/u);
  assert.match(event.description, /Anutin said Wang had conveyed/u);
  assert.match(event.description, /Thailand would require agreed ground rules/u);
  assert.match(event.description, /not a tripartite peace negotiation/u);
  assert.doesNotMatch(event.title + event.description, /Mediates Bangkok Peace Talks|joint operations to dismantle/u);
  assert.deepEqual(event.evidenceIds, [reutersId, nationId]);
});

test("Thai and Khmer copy preserve attribution and remove the Thai duplicate-name typo", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.titleTh + event.descriptionTh, /[\u0E00-\u0E7F]/u);
  assert.match(event.titleKh + event.descriptionKh, /[\u1780-\u17FF]/u);
  assert.match(event.descriptionTh, /นายอนุทินกล่าว/u);
  assert.match(event.descriptionKh, /លោក អនុទីន បាននិយាយ/u);
  assert.doesNotMatch(event.descriptionTh, /นายนายอนุทิน/u);
  for (const text of [event.titleTh, event.descriptionTh, event.titleKh, event.descriptionKh]) {
    assert.doesNotMatch(text, /\?|�/u);
  }
});

test("Reuters-derived copies share provenance and do not count as independent evidence", () => {
  const news = readJsonl("data/news/2026-04.jsonl");
  const byId = new Map(news.map((row) => [row.id, row]));
  assert.equal(byId.get(reutersId)?.provenanceId, provenanceId);
  assert.equal(byId.get(khmerTimesId)?.provenanceId, provenanceId);
  assert.equal(byId.get(khmerTimesId)?.source, "Reuters via Khmer Times");
  assert.notEqual(byId.get(nationId)?.provenanceId, provenanceId);
});
