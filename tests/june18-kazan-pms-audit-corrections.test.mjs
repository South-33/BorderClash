import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Kazan leaders discussion uses the summit event date and no invented exact time", () => {
  const event = readJsonl("data/timeline/2026-06.jsonl")
    .find((row) => row.id === "ks74ejp4x1jzfn0twkcdns4py988yn0g");
  assert.ok(event);
  assert.equal(event.date, "2026-06-18");
  assert.equal(event.timeOfDay, "");
  assert.match(event.title, /Hun Manet Reports Informal/u);
  assert.match(event.description, /reiterated Cambodia’s positions/u);
  assert.match(event.description, /do not establish a mutual Thai-Cambodian commitment/u);
  assert.deepEqual(event.evidenceIds, [
    "jn73j32x9ms1kmkp5ce461qr1n88zpdj",
    "35f8072654fcb9c3fbb9bec682e405ef",
    "b563d776e38e3fbeee5e76f02309a300",
  ]);
});

test("Cambodian reports share provenance while the Thai summit source remains independent", () => {
  const news = readJsonl("data/news/2026-06.jsonl");
  const khmerTimes = news.find((row) => row.id === "jn73j32x9ms1kmkp5ce461qr1n88zpdj");
  const akp = news.find((row) => row.id === "35f8072654fcb9c3fbb9bec682e405ef");
  const thaiMfa = news.find((row) => row.id === "b563d776e38e3fbeee5e76f02309a300");
  assert.ok(khmerTimes);
  assert.ok(akp);
  assert.ok(thaiMfa);
  assert.equal(khmerTimes.provenanceId, "hun-manet-kazan-border-jun18");
  assert.equal(akp.provenanceId, "hun-manet-kazan-border-jun18");
  assert.equal(thaiMfa.provenanceId, undefined);
  assert.equal(news.some((row) => row.id === "c6c85d23279298ada0fb8344c91ff041"), false);
  assert.equal(news.some((row) => row.id === "6ac0882268dea5b0c038ce1d9ab359a4"), false);
});
