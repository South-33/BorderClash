import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Dec 7 anchor preserves the shared chronology and attributes the disputed initiator", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const news = readJsonl("data/news/2025-12.jsonl");
  const event = timeline.find((row) => row.id === "ks78yf2d1j34ssaj8pgwvnkfm18124p8");
  assert.ok(event);
  assert.equal(event.date, "2025-12-07");
  assert.equal(event.timeOfDay, "14:15");
  assert.match(event.title, /Both Sides Blame the Other/u);
  assert.match(event.description, /Thai authorities said Cambodian troops opened fire/u);
  assert.match(event.description, /Cambodia's Defence Ministry said Thai troops attacked first/u);
  assert.match(event.description, /two soldiers wounded/u);
  assert.match(event.description, /four northeastern border provinces/u);
  assert.match(event.description, /additional firing around 20:00/u);
  assert.match(event.description, /responsibility for initiating the firing remains disputed/u);
  assert.doesNotMatch(event.description, /Cambodia claimed self-defense against 'Thai aggression'/u);
  assert.deepEqual(event.evidenceIds, [
    "5b68e9778c56dc4073cabd1388fd5348",
    "20a77b1d23a478a908121dc24859e7bd",
    "e74f50cf07569e933d0ee70d1bd8dcdc",
  ]);

  for (const id of [
    "5b68e9778c56dc4073cabd1388fd5348",
    "e74f50cf07569e933d0ee70d1bd8dcdc",
    "k9749nz3bjcvc850pmv968c2v97xewgk",
    "js7cgm4gqbkcbysaf8n810mj1n7xf097",
  ]) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, "thai-official-dec7-phu-pha-lek-account");
  }
  for (const id of ["20a77b1d23a478a908121dc24859e7bd", "jn74x07m3a90cdadwkehq3zk057xeqkf"]) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, "cambodia-mod-dec7-prorlean-thmar-account");
  }
});
