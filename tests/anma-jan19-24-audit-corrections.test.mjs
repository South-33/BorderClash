import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("An Ses Buddha-statue chronology separates Jan 19 activity from Jan 22 protest", () => {
  const timeline = readJsonl("data/timeline/2026-01.jsonl");
  const news = readJsonl("data/news/2026-01.jsonl");
  const jan19 = timeline.find((row) => row.id === "ks75zxc09f16xpjy3vzbmyc2eh8126dr");
  const jan22 = timeline.find((row) => row.id === "ks7bgqdd5k6h6h4kfrt4mg5pjh812y6c");
  const cna = news.find((row) => row.id === "k9797vv27cwmdqxmdd3qty8c2s806dqf");
  const primary = news.find((row) => row.id === "6766f28a1287cbc9b78cce3284441308");
  const khmerTimes = news.find((row) => row.id === "jn76z1g2jbfmd3bpdp15w3hgpn7zm7fx");

  assert.ok(jan19);
  assert.ok(jan22);
  assert.ok(cna);
  assert.ok(primary);
  assert.ok(khmerTimes);
  assert.equal(jan19.date, "2026-01-19");
  assert.equal(jan19.timeOfDay, undefined);
  assert.match(jan19.description, /activities carried out by Thai forces on January 19/u);
  assert.doesNotMatch(jan19.description, /permanent bunkers/iu);
  assert.match(jan19.description, /Sovereignty over the locations remains disputed/u);
  assert.deepEqual(jan19.evidenceIds, [
    "6766f28a1287cbc9b78cce3284441308",
    "k9797vv27cwmdqxmdd3qty8c2s806dqf",
    "js79y2vkzgjmwxqjzv6b2c0jj97zmw69",
  ]);
  assert.equal(jan22.date, "2026-01-22");
  assert.equal(jan22.timeOfDay, undefined);
  assert.match(jan22.title, /Religion Ministry Protests/u);
  assert.match(jan22.description, /underlying sovereignty claim remains disputed/u);
  assert.deepEqual(jan22.evidenceIds, [
    "b6036fd134513804be86c8fe1d5dd958",
    "jn7edds92ehj4gahyvaar2fd9h7zr5jp",
  ]);
  assert.equal(timeline.some((row) => row.id === "ks7e7yng3gepw698yqvrhwgn1n812jh3"), false);
  assert.match(cna.summary, /January 19/u);
  assert.equal(primary.provenanceId, "cambodia-government-jan21-jan19-border-works");
  assert.equal(khmerTimes.provenanceId, primary.provenanceId);
});
