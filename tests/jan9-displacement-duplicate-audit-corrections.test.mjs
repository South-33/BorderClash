import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const duplicateId = "ks7fn4gn2kknee20r0pmcevk9n813sgd";
const jan8Id = "ks73dfwrxm77hzmpzvb8ef3pth813gjv";
const jan10Id = "ks7ec6nh690j2mjnfkynnpyn51813s5v";
const akpEvidenceId = "k9783tq3a93vmmets01825tws57yyyd1";

test("redundant Jan 9 displacement briefing is removed from the durable timeline", () => {
  const timeline = readJsonl("data/timeline/2026-01.jsonl");
  assert.equal(timeline.some((row) => row.id === duplicateId), false);

  const jan8 = timeline.find((row) => row.id === jan8Id);
  const jan10 = timeline.find((row) => row.id === jan10Id);
  assert.ok(jan8);
  assert.ok(jan10);
  assert.equal(jan8.date, "2026-01-08");
  assert.equal(jan10.date, "2026-01-10");
  assert.match(jan8.description, /475,387/u);
  assert.match(jan8.description, /173,776/u);
  assert.match(jan10.description, /480,000/u);
  assert.match(jan10.description, /167,000/u);
  assert.match(jan10.description, /reported on January 11/u);
});

test("Jan 9 AKP briefing remains retained in the evidence registry", () => {
  const article = readJsonl("data/news/2026-01.jsonl").find((row) => row.id === akpEvidenceId);
  assert.ok(article);
  assert.equal(article.source, "AKP");
  assert.match(article.summary, /470,000/u);
  assert.match(article.summary, /170,000/u);
});
