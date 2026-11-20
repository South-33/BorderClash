import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Dec 25 death aggregate preserves category differences instead of presenting 96 as direct combat deaths", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const news = readJsonl("data/news/2025-12.jsonl");
  const event = timeline.find((row) => row.id === "ks7aeb3xa6hahx4hmkaybmef3h813nts");
  assert.ok(event);
  assert.equal(event.date, "2025-12-25");
  assert.match(event.title, /Mixed Categories/u);
  assert.match(event.description, /23 soldiers killed/u);
  assert.match(event.description, /one civilian killed in an attack/u);
  assert.match(event.description, /41 other civilian deaths from indirect or collateral effects/u);
  assert.match(event.description, /31 civilian deaths/u);
  assert.match(event.description, /not a uniform tally/u);
  assert.match(event.description, /did not provide a Cambodian military fatality count/u);
  assert.doesNotMatch(event.description, /nearly one million|forced to flee/iu);
  assert.deepEqual(event.evidenceIds, [
    "k971nw4ar0qfs03yrgdp054vpd7y0d7c",
    "fa09715c2217ca6a7a2f3540d3d620ed",
  ]);
  for (const id of ["k971nw4ar0qfs03yrgdp054vpd7y0d7c", "k9752st713z1j0kp0fmbstmf3h7xzt0h"]) {
    const article = news.find((row) => row.id === id);
    assert.equal(article?.provenanceId, "anadolu-dec25-conflict-death-aggregate");
    assert.match(article.summary, /indirect|collateral effects/iu);
  }
});
