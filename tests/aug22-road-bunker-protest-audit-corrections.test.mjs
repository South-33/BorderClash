import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("August 22 road-and-bunker protest keeps protest date separate from August 20 activities", () => {
  const event = readJsonl("data/timeline/2026-08.jsonl")
    .find((row) => row.id === "ks7639qy96ygrbkpsxzgekgzz98d91vy");
  const article = readJsonl("data/news/2026-08.jsonl")
    .find((row) => row.id === "jn75efbmwpr736d9a276frq1kx8d9znn");

  assert.ok(event);
  assert.ok(article);
  assert.equal(event.date, "2026-08-22");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Alleged Thai Road and Bunker Construction/u);
  assert.match(event.description, /August 20 is the latest underlying activity date/u);
  assert.match(event.description, /Cambodia said/u);
  assert.match(article.summary, /On August 22/u);
  assert.match(article.summary, /August 20/u);
  assert.match(article.summary, /not the underlying territorial claims/u);
});
