import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks73sad7g6j40n90caty66jmpd83sycy";
const row = () => readFileSync("data/timeline/2026-03.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse).find((item) => item.id === id);

test("Mar 27 navy record keeps possible arming attributed and removes exact time", () => {
  const event = row();
  assert.equal(event.date, "2026-03-27");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, ["js70ap35kazckwsndapt77exs183pxg5"]);
  assert.match(event.description, /20-30 Cambodian fishing boats/u);
  assert.match(event.description, /did not confirm that the boats were armed/u);
  assert.doesNotMatch(event.title, /^Thai Navy Monitors Armed/u);
});

test("Mar 27 source summary does not turn possible arming into a confirmed fact", () => {
  const article = readFileSync("data/news/2026-03.jsonl", "utf8")
    .trim().split(/\r?\n/u).map(JSON.parse)
    .find((item) => item.id === "js70ap35kazckwsndapt77exs183pxg5");
  assert.ok(article);
  assert.match(article.summary, /watching that possibility/u);
  assert.match(article.summary, /rather than confirming the boats were armed/u);
  assert.doesNotMatch(article.summary, /20-30 armed Cambodian fishing vessels/u);
});
