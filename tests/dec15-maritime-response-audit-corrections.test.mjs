import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Dec 15 maritime response is separated from the border-closure dispute and absorbs the Dec 16 duplicate", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const event = timeline.find((row) => row.id === "ks7btfxrfyj8czn8eakyvj87vh8130mh");

  assert.ok(event);
  assert.equal(event.date, "2025-12-15");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Maritime-Route Threat/u);
  assert.match(event.description, /Phan Rim/u);
  assert.match(event.description, /proposed Thai maritime restrictions/u);
  assert.match(event.description, /not evidence that a Gulf blockade had taken effect/u);
  assert.doesNotMatch(event.description, /Interior Ministry|border closure|indefinite|non-negotiable/iu);
  assert.equal(timeline.some((row) => row.id === "ks7d512q18r0qz5fc6spnjdw418123bs"), false);
  assert.deepEqual(event.evidenceIds, [
    "5bc0f160d1aca02da4bf2b294df11441",
    "jn7fg46sdrzj4xcg29dpgbb4cd7xd1h3",
    "js76e42cgshgh2e4h996j9xecn7xd2bc",
  ]);
});

test("Dec 15 source records identify shared official-statement provenance and keep source attribution bounded", () => {
  const news = readJsonl("data/news/2025-12.jsonl");
  const byId = new Map(news.map((row) => [row.id, row]));

  for (const id of [
    "5bc0f160d1aca02da4bf2b294df11441",
    "jn708bqgstmmq4dzgnnhdntkh97xbxez",
    "jn7fg46sdrzj4xcg29dpgbb4cd7xd1h3",
    "js76e42cgshgh2e4h996j9xecn7xd2bc",
  ]) {
    assert.equal(byId.get(id)?.provenanceId, "cambodia-mpwt-phan-rim-maritime-dec15");
  }

  for (const id of [
    "b059cd63f4d7dee918e80f12f7fa6959",
    "jn7f17b2wzk2jrehks1egyczgh7xb0n6",
    "jn761bf0g1sr70ygpr2n5ef8en7xbr6c",
    "jn71p8edyexkgcj5631gp21kdd7xa490",
    "jn72e5wvkb6v8cd5tv3z66s4bx7xbzt6",
  ]) {
    assert.equal(byId.get(id)?.provenanceId, "cambodia-interior-border-travel-dec14");
  }

  const akp = byId.get("5bc0f160d1aca02da4bf2b294df11441");
  assert.equal(akp?.source, "AKP");
  assert.equal(akp?.credibility, 80);

  const thaiPbs = byId.get("js76e42cgshgh2e4h996j9xecn7xd2bc");
  assert.match(thaiPbs?.summary || "", /Ministry of Public Works and Transport spokesperson Phan Rim/u);
  assert.doesNotMatch(thaiPbs?.summary || "", /Prime Minister's spokesman/iu);

  const khmerTimes = byId.get("jn7fg46sdrzj4xcg29dpgbb4cd7xd1h3");
  assert.match(khmerTimes?.summary || "", /article separately cited maritime-law analysis/iu);
});
