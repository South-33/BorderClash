import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Dec 14 Gulf measures remain proposals until formal security approval", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks741k2phyr6sfxmsxjbsfqyhh812142");
  const thaiPbs = readJsonl("data/news/2025-12.jsonl")
    .find((row) => row.id === "js7fytcgf3f326bq6we1ghchas7xbbmk");
  assert.ok(event);
  assert.ok(thaiPbs);
  assert.equal(event.date, "2025-12-14");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Proposes Gulf Supply Restrictions/u);
  assert.match(event.description, /no order on those measures was yet in force/u);
  assert.doesNotMatch(event.description, /closed high-risk roads|formal blockade order has been issued/iu);
  assert.deepEqual(event.evidenceIds, [
    "js79pnx5b551ykgg2nerjm77ds7x8qp8",
    "k972f1x5x11g1vwaryeqz3m3517xa7xq",
    "js7fytcgf3f326bq6we1ghchas7xbbmk",
  ]);
  assert.match(thaiPbs.summary, /asked the Defence Ministry and National Security Council to consider formal measures/u);
  assert.match(thaiPbs.summary, /awaiting formal approval rather than an already implemented Gulf blockade/u);
});
