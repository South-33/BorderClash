import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7bcqym8f2ghdhc49506x0ejs813bwd";
const yahooId = "k975mec8h9zm1k6b82kma0nbgd7xtts3";
const nstId = "84cd3055ca9865134f76d7b41c289e60";
const provenanceId = "sihasak-kl-press-conference-2025-12-22";

test("December 22 Sihasak remarks distinguish the October declaration from the July ceasefire", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-22");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /October Joint Declaration/u);
  assert.match(event.description, /Sihasak Phuangketkeow/u);
  assert.match(event.description, /October Joint Declaration/u);
  assert.match(event.description, /United States wanted it signed in time/u);
  assert.doesNotMatch(event.description, /at least 74/u);
  assert.doesNotMatch(event.title, /Blames US Pressure.*Collapse/u);
  assert.deepEqual(event.evidenceIds, [yahooId, nstId]);
});

test("the evidence registry preserves the Yahoo article's July wording and shares press-conference provenance", () => {
  const articles = readJsonl("data/news/2025-12.jsonl");
  const yahoo = articles.find((row) => row.id === yahooId);
  const nst = articles.find((row) => row.id === nstId);
  assert.ok(yahoo);
  assert.ok(nst);
  assert.match(yahoo.summary, /July ceasefire was 'rushed'/u);
  assert.match(yahoo.summary, /October agreement later unravelled/u);
  assert.doesNotMatch(yahoo.summary, /October ceasefire was pushed too quickly/u);
  assert.equal(yahoo.provenanceId, provenanceId);
  assert.equal(nst.provenanceId, provenanceId);
  assert.match(nst.summary, /previous ceasefire declaration had been rushed/u);
});
