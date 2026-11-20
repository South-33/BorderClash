import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Dec 9 Article 51 milestone records Thailand's formal UN notification and both sides' competing claims", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === "ks7bgecvjv2s5syvwz3fxynt418121z5");
  const news = readJsonl("data/news/2025-12.jsonl");
  const thaiPrimary = news.find((row) => row.id === "070b1e3c12a69f7cc6bfffa9fefee5a5");
  const nation = news.find((row) => row.id === "k972z0rcjz9x7kka7v90qve3y57x7yce");
  const cambodiaPrimary = news.find((row) => row.id === "d401cf05d075c9260194a372f370b4db");

  assert.ok(event);
  assert.ok(thaiPrimary);
  assert.ok(nation);
  assert.ok(cambodiaPrimary);
  assert.equal(event.date, "2025-12-09");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Formally Notifies UN Security Council/u);
  assert.match(event.description, /signed letter to the President of the UN Security Council/u);
  assert.match(event.description, /necessary, proportionate and limited/u);
  assert.match(event.description, /Cambodia disputed Thailand's account the same day/u);
  assert.match(event.description, /not who initiated the fighting/u);
  assert.deepEqual(event.evidenceIds, [thaiPrimary.id, nation.id, cambodiaPrimary.id]);
  assert.equal(thaiPrimary.provenanceId, "thailand-unsc-dec9-article51-letter");
  assert.equal(nation.provenanceId, thaiPrimary.provenanceId);
  assert.match(cambodiaPrimary.summary, /Article 51/u);
});
