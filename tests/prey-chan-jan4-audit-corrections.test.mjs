import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Jan 4 Prey Chan row stays with the contemporaneous Cambodian protest and drops later March figures", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === "ks7294jbp24p5cvezqbv335vwd813ech");
  const article = readJsonl("data/news/2026-01.jsonl").find((row) => row.id === "jn78mtwen79ag7edyeaadq4sr97yj3tj");

  assert.ok(event);
  assert.ok(article);
  assert.equal(event.date, "2026-01-04");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(event.category, "diplomatic");
  assert.match(event.description, /acting spokesperson Chan Ratana/u);
  assert.match(event.description, /These are Cambodian government allegations/u);
  assert.doesNotMatch(event.description, /March 2026|800 hectares|tens of thousands/iu);
  assert.deepEqual(event.evidenceIds, [article.id]);

  assert.equal(article.category, "diplomatic");
  assert.match(article.summary, /On January 4/u);
  assert.match(article.summary, /does not independently establish sovereignty/u);
  assert.doesNotMatch(article.summary, /March 2026|800 hectares/iu);
});
