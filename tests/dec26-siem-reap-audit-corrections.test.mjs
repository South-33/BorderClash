import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Dec 26 Siem Reap strike row uses the reported times and keeps the claims attributed", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const news = readJsonl("data/news/2025-12.jsonl");
  const event = timeline.find((row) => row.id === "ks78ghgv9nch9kdk4ht4cr8m29813nd8");
  assert.ok(event);
  assert.equal(event.date, "2025-12-26");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Cambodian Defence Ministry Reports/u);
  assert.match(event.description, /at 13:40/u);
  assert.match(event.description, /at 14:20/u);
  assert.match(event.description, /seven bombs were dropped in Srei Snam/u);
  assert.match(event.description, /80 kilometres from active combat zones/u);
  assert.match(event.description, /No Thai official acknowledgment/u);
  assert.match(event.description, /remain attributed to Cambodian reporting/u);
  assert.doesNotMatch(event.description, /10 bombs|80km from the border|deepest incursions/iu);
  for (const id of ["7d91d9e88ce4596bf84c633c35e6473c", "4e259b3c46dd12e5cbbbdf828205c824", "jn7apxkrnqvq7wzzzkjwy2rg4h7y18zk"]) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, "cambodia-mod-dec26-siem-reap-strikes");
  }
  const khmerTimes = news.find((row) => row.id === "jn7apxkrnqvq7wzzzkjwy2rg4h7y18zk");
  assert.equal(khmerTimes?.status, "archived");
  assert.equal(khmerTimes?.credibility, 40);
  assert.match(khmerTimes?.summary || "", /inconsistent report/u);
});
