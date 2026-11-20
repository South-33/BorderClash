import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Dec 27 anchor records the signed ceasefire terms rather than later humanitarian updates", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const news = readJsonl("data/news/2025-12.jsonl");
  const event = timeline.find((row) => row.id === "ks7bj3fvt1qh73xyperhk06shh8123ve");
  assert.ok(event);
  assert.equal(event.date, "2025-12-27");
  assert.equal(event.timeOfDay, "12:00");
  assert.match(event.title, /16-Point Ceasefire Effective at Noon/u);
  assert.match(event.description, /signed a 16-point Joint Statement at 10:15/u);
  assert.match(event.description, /took effect at 12:00 noon/u);
  assert.match(event.description, /freeze current troop deployments/u);
  assert.match(event.description, /18 Cambodian soldiers/u);
  assert.match(event.description, /did not prejudge border demarcation/u);
  assert.doesNotMatch(event.description, /Kantharalak|80,000|660 shelters|additional death/iu);
  assert.deepEqual(event.evidenceIds, [
    "3ced6af0d14ecb83ec06bb80d9013eb7",
    "jn73w7tz5m576j5v4vk9m61fn17y44k2",
    "k977dke5cmr64d613nnhc0209n7y2dtj",
    "k9761061n1gctb3wvvt1f4yvg97y443j",
  ]);
  for (const id of [
    "3ced6af0d14ecb83ec06bb80d9013eb7",
    "jn73w7tz5m576j5v4vk9m61fn17y44k2",
    "js753a0gbykv7cr1mz5rfk2yk57y2hme",
    "js70qw1dyy8gh1efxz8w32b1q97y2hdb",
    "jn7aa0havf4qj65qbeak3hfp917y3x4r",
  ]) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, "dec27-gbc-joint-statement");
  }
});
