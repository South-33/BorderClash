import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

const execFileAsync = promisify(execFile);
const CONTROL_URL = (process.env.GEMINI_STUDIO_CONTROL_URL
  || "https://believable-unplagiarised-josette.ngrok-free.dev").replace(/\/+$/, "");
const isJson = process.argv.includes("--json");

function iso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function runConvex(functionName) {
  const convexCli = resolve(process.cwd(), "node_modules", "convex", "bin", "main.js");
  const { stdout } = await execFileAsync(
    process.execPath,
    [convexCli, "run", functionName, "{}"],
    { cwd: process.cwd(), encoding: "utf8", timeout: 30_000, maxBuffer: 2_000_000 },
  );
  return JSON.parse(stdout.trim());
}

async function fetchJson(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${CONTROL_URL}${path}`, {
      headers: { "ngrok-skip-browser-warning": "true", Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function summarizeRequest(request) {
  if (!request) return null;
  return {
    id: request.request_id,
    status: request.status,
    chars: request.prompt_chars,
    thinking: request.effective_thinking_level || request.thinking_level,
    attempts: request.attempts ?? null,
    error: request.error || null,
    startedAt: request.started_at || null,
    finishedAt: request.finished_at || null,
  };
}

const started = Date.now();
const results = await Promise.allSettled([
  runConvex("api:getStats"),
  runConvex("api:getDashboardStats"),
  fetchJson("/v1/endpoint"),
  fetchJson("/v1/diagnostics"),
]);

const [statsResult, dashboardResult, endpointResult, diagnosticsResult] = results;
const stats = statsResult.status === "fulfilled" ? statsResult.value : null;
const dashboard = dashboardResult.status === "fulfilled" ? dashboardResult.value : null;
const endpoint = endpointResult.status === "fulfilled" ? endpointResult.value : null;
const diagnostics = diagnosticsResult.status === "fulfilled" ? diagnosticsResult.value : null;
const pool = diagnostics?.pool || null;
const worker = pool?.workers?.[0] || null;
const recent = diagnostics?.recent_requests || [];
const activeRequest = pool?.active_request
  ? summarizeRequest(recent.find((request) => request.status === "started") || recent.at(-1))
  : null;
const recentFailures = recent
  .filter((request) => request.status === "failed")
  .slice(-3)
  .reverse()
  .map(summarizeRequest);

const summary = {
  elapsedMs: Date.now() - started,
  convex: stats ? {
    status: stats.systemStatus,
    paused: stats.isPaused,
    lastResearchAt: iso(stats.lastResearchAt),
    nextRunAt: iso(stats.nextRunAt),
    scheduleHours: stats.lastCycleInterval,
    reason: stats.schedulingReason,
  } : null,
  dashboard: dashboard ? {
    lastUpdatedAt: iso(dashboard.lastUpdatedAt),
    conflictLevel: dashboard.conflictLevel,
    staleVsResearchMinutes: stats?.lastResearchAt && dashboard.lastUpdatedAt
      ? Math.round((stats.lastResearchAt - dashboard.lastUpdatedAt) / 60_000)
      : null,
  } : null,
  transport: endpoint ? {
    transport: endpoint.transport,
    dataPlane: endpoint.data_plane_url,
    controlPlane: endpoint.control_plane_url,
    updatedAt: endpoint.updated_at,
  } : null,
  gemini: diagnostics ? {
    status: diagnostics.status,
    browserState: pool?.browser_state,
    active: pool?.active_request,
    queued: pool?.queued_requests,
    workerRecreations: pool?.worker_recreation_count,
    phase: worker?.current_state?.phase || null,
    pageTitle: worker?.current_state?.page_title || null,
    model: worker?.current_state?.model_button_text?.replace(/\s+/g, " ").trim() || null,
    selectedThinking: worker?.selected_thinking_level || null,
    activeRequest,
    recentFailures,
  } : null,
  errors: results.map((result, index) => result.status === "rejected"
    ? ["convexStats", "dashboardStats", "endpoint", "diagnostics"][index] + ": " + result.reason.message
    : null).filter(Boolean),
};

if (isJson) {
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.errors.length ? 1 : 0;
} else {
  console.log(`live-diagnostics ${summary.elapsedMs}ms`);
  if (summary.convex) {
    console.log(`convex: ${summary.convex.status} paused=${summary.convex.paused} next=${summary.convex.nextRunAt} (${summary.convex.scheduleHours}h)`);
    console.log(`schedule: ${summary.convex.reason}`);
  }
  if (summary.dashboard) {
    console.log(`dashboard: updated=${summary.dashboard.lastUpdatedAt} stale_vs_research=${summary.dashboard.staleVsResearchMinutes}m level=${summary.dashboard.conflictLevel}`);
  }
  if (summary.transport) {
    console.log(`transport: ${summary.transport.transport} data=${summary.transport.dataPlane}`);
  }
  if (summary.gemini) {
    console.log(`gemini: ${summary.gemini.status} browser=${summary.gemini.browserState} active=${summary.gemini.active} queued=${summary.gemini.queued} model=${summary.gemini.model || "-"} phase=${summary.gemini.phase || "-"}`);
    if (summary.gemini.activeRequest) {
      const request = summary.gemini.activeRequest;
      console.log(`active_request: ${request.id} chars=${request.chars} thinking=${request.thinking} attempts=${request.attempts ?? "-"}`);
    }
    for (const request of summary.gemini.recentFailures) {
      console.log(`failure: ${request.id} chars=${request.chars} attempts=${request.attempts ?? "-"} error=${request.error}`);
    }
  }
  for (const error of summary.errors) console.log(`error: ${error}`);

  process.exitCode = summary.errors.length ? 1 : 0;
}
