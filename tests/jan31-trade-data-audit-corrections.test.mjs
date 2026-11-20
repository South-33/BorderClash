import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7df5w1mca9z6kc91g5kfxzk9813cd9";
const articleId = "jn726jzp40enns8ps8pmkmwmds80ykfc";

test("January trade record is date-only and distinguishes imports from total bilateral trade", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-01-31");
  assert.equal(event.timeOfDay, "");
  assert.match(event.title, /Imports from Thailand Fall 49\.3%/u);
  assert.match(event.title, /Bilateral Trade Down 43\.5%/u);
  assert.match(event.description, /USD 151 million/u);
  assert.match(event.description, /USD 58 million/u);
  assert.match(event.description, /USD 209 million/u);
  assert.match(event.description, /did not establish that those restrictions alone caused/u);
  assert.doesNotMatch(event.title, /Bilateral Trade Plunges 50/u);
  assert.deepEqual(event.evidenceIds, [articleId]);
});

test("Khmer Times summary preserves all three January customs measures without causal overclaim", () => {
  const article = readJsonl("data/news/2026-02.jsonl").find((row) => row.id === articleId);
  assert.ok(article);
  assert.match(article.summary, /imports from Thailand above USD 151 million, down 49\.3%/u);
  assert.match(article.summary, /exports to Thailand above USD 58 million, down 19\.6%/u);
  assert.match(article.summary, /total bilateral trade above USD 209 million, down 43\.5%/u);
  assert.match(article.summary, /without establishing those restrictions as the sole cause/u);
});
