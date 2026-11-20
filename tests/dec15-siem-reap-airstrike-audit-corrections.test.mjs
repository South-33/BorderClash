import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Dec 15 Siem Reap airstrike row preserves reported times without inventing a single exact time", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const news = readJsonl("data/news/2025-12.jsonl");
  const event = timeline.find((row) => row.id === "ks7fes3xqqez0717ay5fwfmtzh8139ex");
  const ap = news.find((row) => row.id === "k9747t1xh6gdfq28y6x4tychkd7xada3");

  assert.ok(event);
  assert.ok(ap);
  assert.equal(event.date, "2025-12-15");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Cambodia Reports Thai F-16 Strikes/u);
  assert.match(event.description, /10:08/u);
  assert.match(event.description, /10:11/u);
  assert.match(event.description, /more than 70 km from the border/u);
  assert.match(event.description, /Thailand defended its air operations/u);
  assert.match(event.description, /remain attributed/u);
  assert.doesNotMatch(event.description, /AP News confirmed|AP confirmed/iu);
  assert.deepEqual(event.evidenceIds, [
    "jn710bmqx06e31htwkn45fh8cx7xbkqn",
    "k9747t1xh6gdfq28y6x4tychkd7xada3",
    "k971ymacnbcy2p2cv0eqwjyh9s7xfbr7",
  ]);
  assert.match(ap.summary, /Thailand defended its air operations/u);
  assert.match(ap.summary, /competing claims/u);
});
