import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Dec 29 JBC proposal is separated from Thailand's later response", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const event = timeline.find((row) => row.id === "ks7awhyt7036xk7qnkc109xb0h813xcm");

  assert.ok(event);
  assert.equal(event.date, "2025-12-29");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /sent its Thai counterpart a diplomatic note/u);
  assert.match(event.description, /first week of January 2026/u);
  assert.match(event.description, /would not recognise boundary changes resulting from the use of force/u);
  assert.doesNotMatch(event.description, /caretaker government|landmines|Thailand responded/iu);
  assert.deepEqual(event.evidenceIds, [
    "k973ztj9x4jf00sr4r69czb7c97ydnag",
    "jn71naa1p9hgctjf88xycayztd7y8bqq",
  ]);
});

test("Jan 5 JBC re-proposal absorbs publication-date duplicates", () => {
  const timeline = readJsonl("data/timeline/2026-01.jsonl");
  const survivor = timeline.find((row) => row.id === "ks7590c82v3egj5qajrzrdjnm98136vy");

  assert.ok(survivor);
  assert.equal(survivor.date, "2026-01-05");
  assert.equal(timeline.some((row) => row.id === "ks782vsf5zfehrcqby3nsafne5812ahz"), false);
  assert.equal(timeline.some((row) => row.id === "ks779h6b4t5qwg1s9r8ncvm44h813gxv"), false);
  assert.deepEqual(survivor.evidenceIds, [
    "012c348a909f4d58b21c788df01ac198",
    "k9783rn4hgwztg6xqx5gfvp4458020rx",
  ]);
});

test("JBC source records preserve shared official-statement provenance and chronology", () => {
  const decNews = readJsonl("data/news/2025-12.jsonl");
  const janNews = readJsonl("data/news/2026-01.jsonl");
  const byId = new Map([...decNews, ...janNews].map((row) => [row.id, row]));

  for (const id of ["k973ztj9x4jf00sr4r69czb7c97ydnag", "jn71naa1p9hgctjf88xycayztd7y8bqq"]) {
    assert.equal(byId.get(id)?.provenanceId, "cambodia-ssba-dec29-jbc-note");
  }

  for (const id of [
    "012c348a909f4d58b21c788df01ac198",
    "jn74mnp2snfdhr0vgbqbdp3ckh7z32ev",
    "k9783rn4hgwztg6xqx5gfvp4458020rx",
    "jn73ktk4er7vbzd6t9k1yatt3h7ypye7",
  ]) {
    assert.equal(byId.get(id)?.provenanceId, "cambodia-ssba-jan5-jbc-note");
  }

  const dec29Xinhua = byId.get("k973ztj9x4jf00sr4r69czb7c97ydnag");
  assert.match(dec29Xinhua?.summary || "", /Thailand had not yet commented/u);
  assert.doesNotMatch(dec29Xinhua?.summary || "", /caretaker government|landmines/iu);

  const jan6KhmerTimes = byId.get("jn73ktk4er7vbzd6t9k1yatt3h7ypye7");
  assert.match(jan6KhmerTimes?.summary || "", /January 5 Note Verbale/u);
  assert.match(jan6KhmerTimes?.summary || "", /not a new January 6 request/u);
});
