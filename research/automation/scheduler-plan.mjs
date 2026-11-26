#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_LEAD_MINUTES = 10;
const DEFAULT_RETRY_MINUTES = 5;
const RECOVERY_STATUSES = new Set(["running", "resumable", "ready"]);

export function resolveSchedulerState(state, runtime, delivery) {
  const expected = (
    delivery?.status === "verified"
    && runtime?.runId
    && delivery?.runId === runtime.runId
  ) ? delivery.expectedResearchState : null;
  const currentLastResearchAt = Number(state?.lastResearchAt) || 0;
  const deliveredLastResearchAt = Number(expected?.lastResearchAt) || 0;

  if (deliveredLastResearchAt <= currentLastResearchAt) return state;
  return {
    ...(state || {}),
    lastResearchAt: deliveredLastResearchAt,
    nextRunAt: Number(expected?.nextRunAt) || state?.nextRunAt,
  };
}

export function buildSchedulerPlan({
  state,
  control,
  runtime,
  nowMs = Date.now(),
}) {
  if (!Number.isFinite(nowMs) || nowMs <= 0) throw new Error("nowMs must be a positive timestamp");

  if (control?.stopped) return { action: "stop", runDue: false, reason: "operator_stopped" };
  if (control?.paused || state?.isPaused) return { action: "stop", runDue: false, reason: "paused" };
  if (runtime?.status === "review") return { action: "stop", runDue: false, reason: "review_hold" };

  const retryMs = DEFAULT_RETRY_MINUTES * 60_000;
  if (RECOVERY_STATUSES.has(runtime?.status)) {
    return {
      action: "arm",
      runDue: true,
      wakeAt: Math.round(nowMs + retryMs),
      reason: `recovery_${runtime.status}`,
      targetAt: Number(state?.nextRunAt) || null,
    };
  }

  const targetAt = Number(state?.nextRunAt);
  if (!Number.isFinite(targetAt) || targetAt <= 0) {
    return {
      action: "arm",
      runDue: true,
      wakeAt: Math.round(nowMs + retryMs),
      reason: "missing_target_retry",
      targetAt: null,
    };
  }

  const startAt = Math.round(targetAt - DEFAULT_LEAD_MINUTES * 60_000);
  if (startAt <= nowMs) {
    return {
      action: "arm",
      runDue: true,
      wakeAt: Math.round(nowMs + retryMs),
      reason: "due_retry",
      targetAt: Math.round(targetAt),
      startAt,
    };
  }

  return {
    action: "arm",
    runDue: false,
    wakeAt: startAt,
    reason: "next_target",
    targetAt: Math.round(targetAt),
    startAt,
  };
}

async function readJsonSafe(path) {
  if (!path) return null;
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    options[key] = value;
    index += 1;
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const supported = new Set(["repo-root", "now-ms"]);
  for (const key of Object.keys(options)) {
    if (!supported.has(key)) throw new Error(`Unknown option: --${key}`);
  }
  const repoRoot = resolve(options["repo-root"] || ".");
  const nowMs = options["now-ms"] ? Number(options["now-ms"]) : Date.now();
  const state = await readJsonSafe(resolve(repoRoot, options.state || "data/research-state.json"));
  const control = await readJsonSafe(resolve(repoRoot, options.control || ".work/runner/runtime/control.json"));
  const runtime = await readJsonSafe(resolve(repoRoot, options.runtime || ".work/runner/runtime/runtime.json"));
  const delivery = runtime?.runId
    ? await readJsonSafe(resolve(repoRoot, ".work/runner/logs", runtime.runId + ".delivery.json"))
    : null;
  const effectiveState = resolveSchedulerState(state, runtime, delivery);

  process.stdout.write(JSON.stringify(buildSchedulerPlan({
    state: effectiveState,
    control,
    runtime,
    nowMs,
  })) + "\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    process.stderr.write(`${error?.stack || error}\n`);
    process.exit(1);
  });
}
