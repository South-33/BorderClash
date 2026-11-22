#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_LEAD_MINUTES = 10;
const DEFAULT_RETRY_MINUTES = 5;
const RECOVERY_STATUSES = new Set(["running", "resumable", "ready", "pending-publication"]);

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
  leadMinutes = DEFAULT_LEAD_MINUTES,
  retryMinutes = DEFAULT_RETRY_MINUTES,
}) {
  if (!Number.isFinite(nowMs) || nowMs <= 0) throw new Error("nowMs must be a positive timestamp");
  if (!Number.isFinite(leadMinutes) || leadMinutes < 0 || leadMinutes > 120) {
    throw new Error("leadMinutes must be between 0 and 120");
  }
  if (!Number.isFinite(retryMinutes) || retryMinutes < 1 || retryMinutes > 60) {
    throw new Error("retryMinutes must be between 1 and 60");
  }

  if (control?.stopped) return { action: "stop", reason: "operator_stopped" };
  if (control?.paused || state?.isPaused) return { action: "stop", reason: "paused" };
  if (runtime?.status === "review") return { action: "stop", reason: "review_hold" };

  const retryMs = Math.round(retryMinutes * 60_000);
  if (RECOVERY_STATUSES.has(runtime?.status)) {
    return {
      action: "arm",
      wakeAt: Math.round(nowMs + retryMs),
      reason: `recovery_${runtime.status}`,
      targetAt: Number(state?.nextRunAt) || null,
    };
  }

  const targetAt = Number(state?.nextRunAt);
  if (!Number.isFinite(targetAt) || targetAt <= 0) {
    return {
      action: "arm",
      wakeAt: Math.round(nowMs + retryMs),
      reason: "missing_target_retry",
      targetAt: null,
    };
  }

  const startAt = Math.round(targetAt - leadMinutes * 60_000);
  if (startAt <= nowMs) {
    return {
      action: "arm",
      wakeAt: Math.round(nowMs + retryMs),
      reason: "due_retry",
      targetAt: Math.round(targetAt),
      startAt,
    };
  }

  return {
    action: "arm",
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
  const repoRoot = resolve(options["repo-root"] || ".");
  const nowMs = options["now-ms"] ? Number(options["now-ms"]) : Date.now();
  const leadMinutes = options["lead-minutes"] ? Number(options["lead-minutes"]) : DEFAULT_LEAD_MINUTES;
  const retryMinutes = options["retry-minutes"] ? Number(options["retry-minutes"]) : DEFAULT_RETRY_MINUTES;
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
    leadMinutes,
    retryMinutes,
  })) + "\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    process.stderr.write(`${error?.stack || error}\n`);
    process.exit(1);
  });
}
