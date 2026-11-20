import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Jan 29 RBC row records the secretariat outcome rather than an unsupported high-level collapse", () => {
  const timeline = readJsonl("data/timeline/2026-01.jsonl");
  const news = readJsonl("data/news/2026-01.jsonl");
  const event = timeline.find((row) => row.id === "ks734sbcmyxn6n7fpjhvxczsw9813tzz");
  assert.ok(event);
  assert.equal(event.date, "2026-01-29");
  assert.equal(event.timeOfDay, "09:00");
  assert.equal(event.category, "diplomatic");
  assert.match(event.title, /Secretariat Talks End Without Common Ground/u);
  assert.match(event.description, /planned formal RBC signing and meeting did not proceed/u);
  assert.match(event.description, /did not specify the unresolved points/u);
  assert.doesNotMatch(event.description, /deadlocked over territorial claims|high-level three-day meeting/iu);
  assert.deepEqual(event.evidenceIds, [
    "ae0d9f61ca81237770d92bca4e29a371",
    "js7bn3r9ztpgkes56j4sqpm2qh80532t",
    "k979hc2d3k8cqmdyk2bhah07pn80aq2r",
  ]);

  for (const id of [
    "ae0d9f61ca81237770d92bca4e29a371",
    "k979hc2d3k8cqmdyk2bhah07pn80aq2r",
    "k9789wdksgdxfmfwbksb793bv1805ne8",
    "jn78zqteex2zb0ztkdbtr83nwx80af5j",
  ]) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, "cambodia-mod-jan29-rbc-secretariat-outcome");
  }
  for (const id of [
    "2eeaf545a4855f69a375e8950624e318",
    "js7bn3r9ztpgkes56j4sqpm2qh80532t",
    "js7d38f3ehc1n1ftdwrdbvwj1n805wj3",
    "js7fngzjtev7p2tcybpn0c80vd806z5s",
  ]) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, "thai-first-army-jan29-rbc-secretariat-outcome");
  }
});
