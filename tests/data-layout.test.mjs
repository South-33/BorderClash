import test from "node:test";
import assert from "node:assert/strict";
import { isCanonicalDataPath } from "../lib/data-layout.mjs";

test("accepts only documented canonical data paths", () => {
  for (const path of [
    "state.json",
    "dashboard.json",
    "analysis/thailand.json",
    "analysis/cambodia.json",
    "analysis/neutral.json",
    "news/2026-11/thailand.jsonl",
    "news/2026-11/cambodia.jsonl",
    "news/2026-11/international.jsonl",
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
    "analysis/extra.json",
    "current/dashboard.json",
    "current/state.json",
    "news/2026-11/other.jsonl",
    "news/2026-1/thailand.jsonl",
    "timeline/2026-11/extra.json",
    "timeline/2026-1.jsonl",
  ]) {
    assert.equal(isCanonicalDataPath(path), false, path);
  }
});

