import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("January 14 AOT row records the Choam inspection without inventing a first-round milestone", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl")
    .find((row) => row.id === "ks767ebmdwzk0jydyvkdm5twqn813eam");
  const article = readJsonl("data/news/2026-01.jsonl")
    .find((row) => row.id === "jn79yxj9djbeb3nxvk24425r997z78ab");

  assert.ok(event);
  assert.ok(article);
  assert.equal(event.date, "2026-01-14");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Choam Border Crossing/u);
  assert.match(event.description, /already conducted at other border locations through January 13/u);
  assert.match(event.description, /those attack descriptions remain Cambodian allegations/u);
  assert.doesNotMatch(event.title, /Complete First Round/iu);
  assert.doesNotMatch(event.description, /first time outsiders/iu);
  assert.deepEqual(event.evidenceIds, [article.id]);
  assert.match(article.summary, /On January 14/u);
  assert.match(article.summary, /already been carried out through January 13/u);
});
