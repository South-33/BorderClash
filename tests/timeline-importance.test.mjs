import assert from "node:assert/strict";
import test from "node:test";
import { TIMELINE_IMPORTANCE_ALLOWED, normalizeTimelineImportance } from "../research/lib/timeline-importance.mjs";

test("legacy timeline importance preserves the existing UI thresholds", () => {
  assert.equal(normalizeTimelineImportance(30), 50);
  assert.equal(normalizeTimelineImportance(69), 50);
  assert.equal(normalizeTimelineImportance(70), 70);
  assert.equal(normalizeTimelineImportance(75), 70);
  assert.equal(normalizeTimelineImportance(76), 80);
  assert.equal(normalizeTimelineImportance(89), 80);
  assert.equal(normalizeTimelineImportance(90), 95);
  assert.equal(normalizeTimelineImportance(100), 95);
  assert.deepEqual([...TIMELINE_IMPORTANCE_ALLOWED].sort((a, b) => a - b), [50, 70, 80, 95]);
});
