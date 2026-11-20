import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Dec 16 U.S. alert is recorded as a renewed 50km warning, not a new no-go zone", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const news = readJsonl("data/news/2025-12.jsonl");
  const event = timeline.find((row) => row.id === "ks7ckq1ncmnkmrxpd6krfz8d89813v9a");
  assert.ok(event);
  assert.equal(event.date, "2025-12-16");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Renews 50km Border Avoid-Travel Alert/u);
  assert.match(event.description, /significant escalation/u);
  assert.match(event.description, /repeated its instruction/u);
  assert.match(event.description, /December 8 alert/u);
  assert.match(event.description, /not a newly created exclusion zone/u);
  assert.doesNotMatch(event.title, /No-Go Zone/iu);

  for (const id of [
    "k97b04a2dqxa9mpybp5dc4h1js7xemnk",
    "k97133vnd2s87f5jdfzxmc8c297xqhfn",
  ]) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, "us-embassy-bangkok-dec16-border-security-alert");
  }
});
