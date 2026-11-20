import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Wang Yi phone diplomacy is dated Dec 18 and separated from Deng's Dec 19 meeting", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const event = timeline.find((row) => row.id === "ks7cv1jh0hsvzc0rgc3jxpmda5812qty");

  assert.ok(event);
  assert.equal(event.date, "2025-12-18");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Wang Yi Calls Cambodian and Thai Foreign Ministers/u);
  assert.match(event.description, /separate phone calls/u);
  assert.match(event.description, /expressed willingness to de-escalate and cease fire/u);
  assert.doesNotMatch(event.description, /18 civilian|death toll|Deng Xijun|shuttle-diplomacy trip/iu);
  assert.deepEqual(event.evidenceIds, [
    "00c902df99ebb1f54e320e5e2fbdd8a1",
    "jn54ceaa9b49103f0c36a1c3e7cb8f04",
  ]);

  const deng = timeline.find((row) => row.id === "ks73vpmk92mhg37g26q8z7vwfs813rt8");
  assert.ok(deng);
  assert.equal(deng.date, "2025-12-19");
});

test("Wang call reports share the Chinese MFA statement provenance", () => {
  const news = readJsonl("data/news/2025-12.jsonl");
  const byId = new Map(news.map((row) => [row.id, row]));
  for (const id of [
    "00c902df99ebb1f54e320e5e2fbdd8a1",
    "jn54ceaa9b49103f0c36a1c3e7cb8f04",
    "jn7593pzk29yxnp28yt71pdm617xk9a8",
  ]) {
    assert.equal(byId.get(id)?.provenanceId, "china-mfa-wang-calls-dec18");
  }

  const chinaDaily = byId.get("jn54ceaa9b49103f0c36a1c3e7cb8f04");
  assert.equal(chinaDaily?.title, "China offers to resolve Thailand-Cambodia rift");
  assert.match(chinaDaily?.summary || "", /December 18/u);
});
