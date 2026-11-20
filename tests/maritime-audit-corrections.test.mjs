import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("maritime expansion keeps drone activity attributed and removes unsupported exact time", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks736hjh0thbdd9p525vm8n21n8137h5");
  const article = readJsonl("data/news/2025-12.jsonl")
    .find((row) => row.id === "k977c3r9hx9z15qwvv2wk8gb2s7xmcg9");
  assert.ok(event);
  assert.ok(article);
  assert.equal(event.date, "2025-12-20");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /Thai media claims/u);
  assert.match(event.description, /did not establish a confirmed Cambodian attack/u);
  assert.doesNotMatch(event.description, /Cambodia reportedly launched drone attacks/u);
  assert.match(article.summary, /Thai news outlets claimed/u);
  assert.match(article.summary, /did not establish a confirmed Cambodian drone attack/u);
});
