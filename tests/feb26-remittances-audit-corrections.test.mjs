import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readRows = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);

test("February 26 remittance milestone is date-only and stays within the ministry report", () => {
  const event = readRows("data/timeline/2026-02.jsonl")
    .find((row) => row.id === "ks7aab2kahtfpsdqn9t6j2nwvx8212r7");
  assert.ok(event);
  assert.equal(event.date, "2026-02-26");
  assert.equal(event.timeOfDay, "");
  assert.match(event.description, /US\$1\.86 billion in 2025/u);
  assert.match(event.description, /940,000 workers returning from Thailand after the border conflict/u);
  assert.match(event.description, /320,000 returnees had obtained manufacturing jobs/u);
  assert.doesNotMatch(event.description, /forced|flee|10%|severe economic hardship|rural families/iu);
  assert.deepEqual(event.evidenceIds, [
    "743adec647478d9ae4c0c04c0855766a",
    "js7837011kxbfmnh18ahq66e9982177d",
  ]);
});

test("RYT9 and InfoQuest are recorded as one underlying report chain", () => {
  const news = readRows("data/news/2026-02.jsonl");
  const ryt9 = news.find((row) => row.id === "743adec647478d9ae4c0c04c0855766a");
  const infoquest = news.find((row) => row.id === "js7837011kxbfmnh18ahq66e9982177d");
  assert.ok(ryt9);
  assert.ok(infoquest);
  assert.equal(ryt9.provenanceId, "infoquest-cambodia-remittances-feb26");
  assert.equal(infoquest.provenanceId, ryt9.provenanceId);
  assert.match(infoquest.summary, /433,594/u);
  assert.doesNotMatch(infoquest.summary, /flee|severely impacting/iu);
});
