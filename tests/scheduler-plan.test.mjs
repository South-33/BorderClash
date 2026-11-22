import assert from "node:assert/strict";
import test from "node:test";
import { buildSchedulerPlan, resolveSchedulerState } from "../research/automation/scheduler-plan.mjs";

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;

test("scheduler wakes exactly ten minutes before the public target", () => {
  const targetAt = NOW + 90 * MINUTE;
  const plan = buildSchedulerPlan({
    state: { nextRunAt: targetAt, isPaused: false },
    control: { paused: false, stopped: false },
    runtime: { status: "published" },
    nowMs: NOW,
  });

  assert.deepEqual(plan, {
    action: "arm",
    wakeAt: targetAt - 10 * MINUTE,
    reason: "next_target",
    targetAt,
    startAt: targetAt - 10 * MINUTE,
  });
});

test("scheduler retries five minutes later when the start window is already due", () => {
  const targetAt = NOW + 5 * MINUTE;
  const plan = buildSchedulerPlan({
    state: { nextRunAt: targetAt, isPaused: false },
    control: { paused: false, stopped: false },
    runtime: { status: "published" },
    nowMs: NOW,
  });

  assert.equal(plan.action, "arm");
  assert.equal(plan.reason, "due_retry");
  assert.equal(plan.wakeAt, NOW + 5 * MINUTE);
  assert.equal(plan.targetAt, targetAt);
});

test("recoverable runner states use a five-minute retry regardless of the next target", () => {
  for (const status of ["running", "resumable", "ready", "pending-publication"]) {
    const plan = buildSchedulerPlan({
      state: { nextRunAt: NOW + 24 * 60 * MINUTE, isPaused: false },
      control: { paused: false, stopped: false },
      runtime: { status },
      nowMs: NOW,
    });
    assert.equal(plan.action, "arm");
    assert.equal(plan.wakeAt, NOW + 5 * MINUTE);
    assert.equal(plan.reason, "recovery_" + status);
  }
});

test("operator and review holds leave no active timer", () => {
  assert.deepEqual(
    buildSchedulerPlan({
      state: { nextRunAt: NOW + 60 * MINUTE, isPaused: false },
      control: { stopped: true },
      runtime: { status: "published" },
      nowMs: NOW,
    }),
    { action: "stop", reason: "operator_stopped" },
  );
  assert.deepEqual(
    buildSchedulerPlan({
      state: { nextRunAt: NOW + 60 * MINUTE, isPaused: true },
      control: {},
      runtime: { status: "published" },
      nowMs: NOW,
    }),
    { action: "stop", reason: "paused" },
  );
  assert.deepEqual(
    buildSchedulerPlan({
      state: { nextRunAt: NOW + 60 * MINUTE, isPaused: false },
      control: {},
      runtime: { status: "review" },
      nowMs: NOW,
    }),
    { action: "stop", reason: "review_hold" },
  );
});

test("missing target state retries instead of spinning or silently stopping", () => {
  const plan = buildSchedulerPlan({
    state: { isPaused: false },
    control: {},
    runtime: { status: "published" },
    nowMs: NOW,
  });
  assert.equal(plan.action, "arm");
  assert.equal(plan.reason, "missing_target_retry");
  assert.equal(plan.wakeAt, NOW + 5 * MINUTE);
});

test("verified delivery state overrides a stale production checkout after publication", () => {
  const stale = { lastResearchAt: NOW - 24 * 60 * MINUTE, nextRunAt: NOW + 10 * MINUTE };
  const runtime = { runId: "20261122T000000000Z", status: "published" };
  const delivered = {
    status: "verified",
    runId: runtime.runId,
    expectedResearchState: {
      lastResearchAt: NOW,
      nextRunAt: NOW + 24 * 60 * MINUTE,
    },
  };
  const effective = resolveSchedulerState(stale, runtime, delivered);
  assert.equal(effective.lastResearchAt, NOW);
  assert.equal(effective.nextRunAt, NOW + 24 * 60 * MINUTE);

  const plan = buildSchedulerPlan({
    state: effective,
    control: {},
    runtime,
    nowMs: NOW,
  });
  assert.equal(plan.reason, "next_target");
  assert.equal(plan.wakeAt, NOW + (24 * 60 - 10) * MINUTE);
});

test("older delivery receipts never override newer checkout state", () => {
  const current = { lastResearchAt: NOW, nextRunAt: NOW + 24 * 60 * MINUTE };
  const runtime = { runId: "20261121T000000000Z", status: "published" };
  const delivery = {
    status: "verified",
    runId: runtime.runId,
    expectedResearchState: {
      lastResearchAt: NOW - 60 * MINUTE,
      nextRunAt: NOW + 60 * MINUTE,
    },
  };
  assert.equal(resolveSchedulerState(current, runtime, delivery), current);
});
