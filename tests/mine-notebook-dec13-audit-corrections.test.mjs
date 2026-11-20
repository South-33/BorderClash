import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path) { return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse); }

test("Dec 13 mine-notebook duplicate is merged into the surviving 11:00 Second Army briefing", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  assert.equal(timeline.find((row) => row.id === "ks750gfn0jgefkt5efvbj7yfqn812fra"), undefined);
  const event = timeline.find((row) => row.id === "ks7dzx2cghd9hzvxq0spr14gss8125ws");
  assert.ok(event);
  assert.equal(event.date, "2025-12-13");
  assert.equal(event.timeOfDay, "11:00");
  assert.match(event.title, /Displays Mine Notebook/u);
  assert.match(event.description, /30 devices/u);
  assert.match(event.description, /six devices on August 12/u);
  assert.match(event.description, /six additional mine-laying locations on August 21/u);
  assert.match(event.description, /not independently verified/u);
  assert.doesNotMatch(event.description, /36 anti-personnel mines/iu);
  assert.deepEqual(event.evidenceIds, ["6391f65d2baaadfb973d9845d1866588"]);
});

test("parallel notebook reports remain grouped under the same Second Army briefing provenance", () => {
  const news = readJsonl("data/news/2025-12.jsonl");
  for (const id of ["c9e3504b538cc4ae4d65226cf88c0ff1", "js74b9m9s89gv9y53tv809rxp97x66gj"]) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, "thai-second-army-dec13-1100-briefing");
  }
});