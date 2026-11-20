import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Feb 4 Koh Kong RBC event records the supported start time and both sides' explanations", () => {
  const timeline = readJsonl("data/timeline/2026-02.jsonl");
  const event = timeline.find((row) => row.id === "ks7efscwnpwydpvfmd1kfyvt618123e0");

  assert.ok(event);
  assert.equal(event.date, "2026-02-04");
  assert.equal(event.timeOfDay, "14:17");
  assert.equal(event.title, "Koh Kong RBC Meeting Ends Without Joint Agreement");
  assert.match(event.description, /Cambodia's defence ministry said the session began at 14:17/u);
  assert.match(event.description, /had not reached common ground/u);
  assert.match(event.description, /Thailand's navy said Cambodia had raised boundary-demarcation proposals/u);
  assert.match(event.description, /Thailand considered outside the RBC's objectives/u);
  assert.match(event.description, /No joint agreement was reached/u);
});

test("Thai reports of the Feb 4 RBC outcome share one Royal Thai Navy provenance chain", () => {
  const news = readJsonl("data/news/2026-02.jsonl");
  const byId = new Map(news.map((row) => [row.id, row]));

  for (const id of ["js77q29cprkp1w6q7steqkvr0n80gp9t", "js7d5ryhzcbegx6r4cx71bgsdh80p2kv"]) {
    assert.equal(byId.get(id)?.provenanceId, "thai-navy-feb4-rbc-statement");
  }
});
