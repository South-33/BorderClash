import assert from "node:assert/strict";
import test from "node:test";
import {
  getResearchTimerPhase,
  RESEARCH_RUNNING_GRACE_SECONDS,
} from "../src/app/research-timing.ts";

test("research timer counts down until the target", () => {
  assert.deepEqual(getResearchTimerPhase(61), { phase: "countdown", seconds: 61 });
});

test("research timer shows RUNNING from target through the grace window", () => {
  assert.deepEqual(getResearchTimerPhase(0), { phase: "running" });
  assert.deepEqual(
    getResearchTimerPhase(-(RESEARCH_RUNNING_GRACE_SECONDS - 1)),
    { phase: "running" },
  );
});

test("overdue counter starts at zero after the RUNNING grace window", () => {
  assert.deepEqual(
    getResearchTimerPhase(-RESEARCH_RUNNING_GRACE_SECONDS),
    { phase: "overdue", seconds: 0 },
  );
  assert.deepEqual(
    getResearchTimerPhase(-(RESEARCH_RUNNING_GRACE_SECONDS + 42)),
    { phase: "overdue", seconds: 42 },
  );
});
