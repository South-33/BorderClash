import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8")
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test("Dec 22 airstrikes row stays date-only and preserves both sides' claims", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const event = timeline.find((row) => row.id === "ks7csvjydt6g9273ps4krgrp8h8139r4");
  assert.ok(event);
  assert.equal(event.date, "2025-12-22");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /ASEAN Foreign Ministers Meeting/u);
  assert.match(event.description, /Cambodia's defence ministry said/u);
  assert.match(event.description, /Thai army said/u);
  assert.match(event.description, /two Cambodian military targets/u);
  assert.match(event.description, /did not give an exact time/u);
  assert.deepEqual(event.evidenceIds, ["a460bbf4c3d5ed660c01ece051e97eed"]);
});

test("preserved AFP copies share provenance and the overwritten SpaceWar URL is archived", () => {
  const news = readJsonl("data/news/2025-12.jsonl");
  const oldCopy = news.find((row) => row.id === "k97fe6nj2vgf166nsbypypqaj57xrd3v");
  const replacement = news.find((row) => row.id === "a460bbf4c3d5ed660c01ece051e97eed");
  assert.ok(oldCopy);
  assert.ok(replacement);
  assert.equal(oldCopy.status, "archived");
  assert.equal(oldCopy.provenanceId, "afp-dec22-airstrikes-after-asean");
  assert.equal(replacement.provenanceId, "afp-dec22-airstrikes-after-asean");
  assert.match(replacement.summary, /did not give an exact time/u);
});
