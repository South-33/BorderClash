import test from "node:test";
import assert from "node:assert/strict";
import { isCanonicalDataPath } from "../research/lib/data-paths.mjs";

test("accepts only documented canonical data paths", () => {
  for (const path of [
    "research-state.json",
    "current/impact.json",
    "current/thailand.json",
    "current/cambodia.json",
    "current/summary.json",
    "news/2026-11.jsonl",
    "timeline/2026-11.jsonl",
  ]) {
    assert.equal(isCanonicalDataPath(path), true, path);
  }
});
test("rejects side files and malformed archive paths", () => {
  for (const path of [
    "migration.json",
    "_agent-write-probe.json",
    "notes.txt",
    "analysis/thailand.json",
    "current/dashboard.json",
    "current/state.json",
    "news/2026-11/other.jsonl",
    "news/2026-1.jsonl",
    "news/2026-11/cambodia-domestic.jsonl",
    "timeline/2026-11/extra.json",
    "timeline/2026-1.jsonl",
  ]) {
    assert.equal(isCanonicalDataPath(path), false, path);
  }
});
