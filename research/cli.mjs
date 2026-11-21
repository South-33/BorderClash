import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { newsEnvironmentKey, selectVisibleNews } from "./lib/news.mjs";
import { listFiles, readJson, readJsonl, writeJson } from "./lib/files.mjs";
import { syncNewsLocalization } from "./lib/news-localization.mjs";
import {
  captureChangedArticles,
  ingestCandidates,
  loadArticleRegistry,
  readCandidateFile,
} from "./lib/article-ingest.mjs";
import {
  captureArticle,
  restoreArchiveCopy,
  verifyArchiveCopy,
} from "./lib/evidence-archive.mjs";
import { probeEvidenceUrl } from "./lib/evidence-probe.mjs";
import { reconstructArticle } from "./lib/reconstruct.mjs";
import { summarizeTimelineTimes } from "./lib/timeline-time-check.mjs";
import { checkTimelineTimeProvenance, checkTimelineTimeSupport } from "./lib/time-provenance-check.mjs";
import { checkTimelineChronology } from "./lib/chronology-check.mjs";
import { checkHumanitarianSummaryRisk } from "./lib/humanitarian-check.mjs";
import { checkReferenceCoverage } from "./lib/reference-check.mjs";
import { loadRecordInspection } from "./lib/record-inspection.mjs";
import { buildCapturedEvidence } from "./lib/captured-evidence.mjs";
import { matchSourceInspection } from "./lib/source-inspection.mjs";

const dataRoot = resolve("data");
const command = process.argv[2] || "context";
const DAY_MS = 24 * 3_600_000;
const BRIEF_MIN_DAYS = 7;
const BRIEF_MAX_DAYS = 30;
const BRIEF_NEWS_LIMIT = 6;
const BRIEF_TIMELINE_LIMIT = 12;
const MAX_SCHEDULE_HOURS = 168;

function validateWorkingDataBeforeFinish() {
  const validator = resolve("research", "validate.mjs");
  if (!existsSync(validator)) return;
  const result = spawnSync(process.execPath, [validator], {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status === 0) return;
  const detail = String(result.stderr || result.stdout || "validation failed").trim();
  throw new Error(`finish blocked by local validation; fix the data and retry finish.\n${detail.slice(0, 8000)}`);
}

function latestTimestamp(row) {
  return row.publishedAt || row.fetchedAt || row.lastUpdatedAt || 0;
}

function newsContextTimestamp(row) {
  return Math.max(
    Number(row?.publishedAt || 0),
    Number(row?.fetchedAt || 0),
  );
}

function compactNews(row) {
  return {
    id: row.id,
    publishedAt: row.publishedAt,
    fetchedAt: row.fetchedAt,
    source: row.source,
    sourceUrl: row.sourceUrl,
    credibility: row.credibility,
    status: row.status,
    category: row.category,
    title: row.titleEn || row.title,
  };
}

function compactTimeline(row) {
  return {
    id: row.id,
    date: row.date,
    timeOfDay: row.timeOfDay,
    category: row.category,
    importance: row.importance,
    status: row.status,
    title: row.title,
    sourceCount: Array.isArray(row.evidenceIds) ? row.evidenceIds.length : 0,
  };
}

function timelineTimestamp(row) {
  if (typeof row?.date !== "string") return 0;
  const time = typeof row.timeOfDay === "string" && /^\d{2}:\d{2}$/u.test(row.timeOfDay)
    ? row.timeOfDay
    : "00:00";
  const parsed = Date.parse(`${row.date}T${time}:00+07:00`);
  return Math.max(
    Number.isFinite(parsed) ? parsed : 0,
    Number(row?.createdAt || 0),
  );
}

function selectBriefContext({ state, news, timeline, nowMs }) {
  const lastResearchAt = Number(state.lastResearchAt || 0);
  const minimumStart = nowMs - BRIEF_MIN_DAYS * DAY_MS;
  const maximumStart = nowMs - BRIEF_MAX_DAYS * DAY_MS;
  const desiredStart = lastResearchAt > 0 ? Math.min(lastResearchAt, minimumStart) : minimumStart;
  const windowStart = Math.max(maximumStart, desiredStart);
  const eligibleNews = Object.fromEntries(
    Object.entries(news).map(([environment, rows]) => [
      environment,
      selectVisibleNews(rows, rows.length),
    ]),
  );
  const contextNews = Object.fromEntries(
    Object.entries(eligibleNews).map(([environment, rows]) => [
      environment,
      rows.filter((row) => newsContextTimestamp(row) >= windowStart),
    ]),
  );
  const contextTimeline = timeline.filter((row) => timelineTimestamp(row) >= windowStart);
  const sinceNews = Object.fromEntries(
    Object.entries(eligibleNews).map(([environment, rows]) => [
      environment,
      rows.filter((row) => newsContextTimestamp(row) >= lastResearchAt),
    ]),
  );
  const sinceTimeline = lastResearchAt > 0
    ? timeline.filter((row) => timelineTimestamp(row) >= lastResearchAt)
    : contextTimeline;

  return {
    windowStart,
    lookbackDays: Math.ceil((nowMs - windowStart) / DAY_MS),
    cappedAt30Days: desiredStart < maximumStart,
    counts: {
      timeline: contextTimeline.length,
      news: Object.fromEntries(
        Object.entries(contextNews).map(([environment, rows]) => [environment, rows.length]),
      ),
    },
    sinceLastCycleCounts: {
      timeline: sinceTimeline.length,
      news: Object.fromEntries(
        Object.entries(sinceNews).map(([environment, rows]) => [environment, rows.length]),
      ),
    },
    news: Object.fromEntries(
      Object.entries(eligibleNews).map(([environment, rows]) => [environment, rows.slice(0, BRIEF_NEWS_LIMIT)]),
    ),
    timeline: contextTimeline.slice(0, BRIEF_TIMELINE_LIMIT),
  };
}

async function brief() {
  const [state, currentSummary] = await Promise.all([
    readJson(join(dataRoot, "research-state.json")),
    readJson(join(dataRoot, "current", "summary.json")),
  ]);

  const timeline = [];
  for (const file of await listFiles(join(dataRoot, "timeline"), ".jsonl")) {
    timeline.push(...await readJsonl(file));
  }
  timeline.sort((a, b) => {
    const date = String(b.date || "").localeCompare(String(a.date || ""));
    if (date !== 0) return date;
    return String(b.timeOfDay || "").localeCompare(String(a.timeOfDay || ""));
  });

  const news = { thailand: [], cambodia: [], international: [] };
  for (const file of await listFiles(join(dataRoot, "news"), ".jsonl")) {
    for (const article of await readJsonl(file)) {
      const environment = newsEnvironmentKey(article.mediaEnvironment);
      if (environment) news[environment].push(article);
    }
  }

  for (const values of Object.values(news)) {
    values.sort((a, b) => latestTimestamp(b) - latestTimestamp(a));
  }
  const configuredNow = Number(process.env.BORDERCLASH_NOW_MS || 0);
  const nowMs = configuredNow > 0 ? configuredNow : Date.now();
  const context = selectBriefContext({ state, news, timeline, nowMs });
  const toIso = (value) => Number.isFinite(value) ? new Date(value).toISOString() : null;
  const output = {
    cycle: {
      now: new Date(nowMs).toISOString(),
      since: toIso(state.lastResearchAt),
      count: state.researchCycleCount,
      previousIntervalHours: state.lastCycleInterval,
      previousReason: state.schedulingReason || "",
    },
    workingCurrent: {
      summary: currentSummary.summary || "",
      keyUpdates: (currentSummary.keyUpdates || [])
        .map((item) => item?.text)
        .filter((value) => typeof value === "string" && value.trim()),
    },
    contextWindow: {
      start: toIso(context.windowStart),
      end: toIso(nowMs),
      lookbackDays: context.lookbackDays,
      cappedAt30Days: context.cappedAt30Days,
      counts: context.counts,
      sinceLastCycleCounts: context.sinceLastCycleCounts,
    },
    recentTimeline: context.timeline.map(compactTimeline),
    recentNews: Object.fromEntries(
      Object.entries(context.news).map(([environment, values]) => [
        environment,
        values.map(compactNews),
      ]),
    ),
  };

  return output;
}

function borderLocalDate(value) {
  if (!Number.isFinite(value)) return "unknown";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Phnom_Penh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function renderContext(output) {
  const timelineRows = output.recentTimeline.slice(0, 4);
  const environmentLabels = { thailand: "TH", cambodia: "KH", international: "INTL" };
  const evidenceRows = Object.entries(output.recentNews)
    .flatMap(([environment, rows]) => rows.map((row) => ({ ...row, environment })))
    .sort((a, b) => latestTimestamp(b) - latestTimestamp(a))
    .slice(0, 4);
  const lines = [
    "# BorderClash live cycle context",
    "",
    "Orientation only: this is revisable working memory, not scope or authority.",
    "",
    "## Live",
    `Now: ${output.cycle.now}`,
    `Last completed cycle: ${output.cycle.since || "unknown"} (#${output.cycle.count})`,
  ];
  if (output.cycle.previousReason) {
    lines.push(`Previous cadence: ${output.cycle.previousIntervalHours || "?"}h — ${output.cycle.previousReason}`);
  }
  lines.push(
    "Canonical paths: data/current/{summary,thailand,cambodia,impact}.json; data/{timeline,news}/YYYY-MM.jsonl",
    "",
    "## Working current picture",
    output.workingCurrent.summary || "No current synthesis.",
  );
  if (output.workingCurrent.keyUpdates.length) {
    lines.push("", "Key updates");
    for (const update of output.workingCurrent.keyUpdates.slice(0, 4)) lines.push(`- ${update}`);
  }

  lines.push(
    "",
    "## Recent anchors",
    `${output.contextWindow.lookbackDays}d ${output.contextWindow.start}..${output.contextWindow.end}${output.contextWindow.cappedAt30Days ? " (30d cap)" : ""}`,
    "",
    "Timeline",
  );

  for (const row of timelineRows) {
    lines.push(`- ${row.date} ${row.timeOfDay || ""} [${row.id}] ${row.title}`.trim());
  }
  if (!timelineRows.length) lines.push("- none");

  lines.push("", "Evidence");
  for (const row of evidenceRows) {
    const label = environmentLabels[row.environment] || row.environment;
    lines.push(`- ${label} ${borderLocalDate(row.publishedAt || row.fetchedAt)} [${row.id}] ${row.source}: ${row.title}`);
  }
  if (!evidenceRows.length) lines.push("- none");
  lines.push("");
  return lines.join("\n");
}

async function ingest(path, { localize = true } = {}) {
  if (!path) throw new Error("ingest requires a JSON or JSONL candidate file");
  const candidatePath = resolve(path);
  if (!existsSync(candidatePath)) {
    process.stderr.write(JSON.stringify({
      ok: false,
      error: "ingest candidate file not found",
      path: candidatePath,
      workspace: process.cwd(),
      nextAction: "Retry with the exact absolute Path returned by write_file, or write the candidate inside this workspace and pass that path.",
    }, null, 2) + "\n");
    process.exitCode = 2;
    return;
  }
  const candidates = await readCandidateFile(candidatePath);
  if (!Array.isArray(candidates) || candidates.length === 0) throw new Error("ingest candidate file is empty");
  const results = await ingestCandidates(candidates, { dataRoot });
  const usableCaptureStatuses = new Set(["captured-html", "captured-document", "captured-text"]);
  const evidenceGaps = results
    .filter(({ capture }) => capture?.status && !usableCaptureStatuses.has(capture.status))
    .map(({ id, sourceUrl, capture }) => ({
      id: id || capture.articleId || null,
      sourceUrl: sourceUrl || null,
      status: capture.status,
    }));
  const localization = localize
    ? await syncNewsLocalization(dataRoot)
    : { skipped: true };
  const created = results.filter(({ action }) => action === "added").length;
  const reused = results.filter(({ action }) => action === "existing").length;
  const needsReview = results.filter(({ action }) => action === "review").length;
  process.stdout.write(JSON.stringify({
    ok: true,
    count: results.length,
    created,
    reused,
    needsReview,
    results,
    evidenceGaps,
    localization,
    nextAction: needsReview
      ? "Resolve needs-review items before relying on them. Other successful batch items remain retained."
      : "Use retained article IDs when your research judgment warrants linking them to timeline/current records.",
  }, null, 2) + "\n");
}

async function syncLocalization() {
  const result = await syncNewsLocalization(dataRoot);
  process.stdout.write(JSON.stringify({ ok: true, ...result }, null, 2) + "\n");
}

async function capture(id, force = false) {
  if (!id) throw new Error("capture requires an article id");
  const registry = await loadArticleRegistry(dataRoot);
  const article = registry.byId.get(id);
  if (!article) throw new Error(`unknown article id: ${id}`);
  const result = await captureArticle(article, { force });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

async function probeSource(url, previewChars = "800") {
  const result = await probeEvidenceUrl(url, { previewChars: Number(previewChars) || 800 });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

async function source(args) {
  if (args[0] === "add") {
    const path = args.find((value, index) => index > 0 && value !== "--no-localize");
    return ingest(path, { localize: !args.includes("--no-localize") });
  }
  const url = args[0];
  if (!url) throw new Error("source requires a URL or: source add <file>");
  const previewChars = args[1] || "1200";
  const registry = await loadArticleRegistry(dataRoot);
  const known = matchSourceInspection(url, { status: "not-fetched", requestedUrl: url }, registry);
  if (known.outcome !== "new") {
    process.stdout.write(JSON.stringify({
      ...known,
      probe: {
        status: "not-needed",
        requestedUrl: url,
        reason: "canonical identity already exists; use record --captured for retained evidence",
      },
    }, null, 2) + "\n");
    return;
  }
  const probe = await probeEvidenceUrl(url, { previewChars: Number(previewChars) || 1200 });
  process.stdout.write(JSON.stringify(matchSourceInspection(url, probe, registry), null, 2) + "\n");
}

async function record(args) {
  const id = args.find((value) => !value.startsWith("--"));
  if (!id) throw new Error("record requires a canonical record id");
  const packet = await loadRecordInspection(id, { cwd: process.cwd(), dataRoot });
  let output = packet;
  if (args.includes("--captured")) {
    const capturedPacket = packet.kind === "news"
      ? { ...packet, evidence: { ...packet.evidence, articles: [packet.record] } }
      : packet;
    output = { ...packet, captured: await buildCapturedEvidence(capturedPacket) };
  }
  process.stdout.write(JSON.stringify({
    ...output,
    readOnly: true,
    nextAction: args.includes("--captured")
      ? "Use this packet as research evidence; edit canonical data only when your judgment warrants it."
      : "Add --captured to inspect retained publisher text for this record's article evidence.",
  }, null, 2) + "\n");
}

function gitOutput(args) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || "git command failed").trim());
  return result.stdout;
}

function parseJsonlText(text) {
  return String(text || "").split(/\r?\n/u).filter((line) => line.trim()).map((line) => JSON.parse(line));
}

function changedTimelineIds(baseRef, paths) {
  const ids = new Set();
  const removedIds = new Set();
  for (const path of paths.filter((value) => /^data\/timeline\/.*\.jsonl$/u.test(value))) {
    let before = [];
    try {
      before = parseJsonlText(gitOutput(["show", `${baseRef}:${path}`]));
    } catch {
      before = [];
    }
    let after = [];
    try {
      after = parseJsonlText(readFileSync(resolve(path), "utf8"));
    } catch {
      after = [];
    }
    const beforeById = new Map(before.map((row) => [row.id, row]));
    const afterById = new Map(after.map((row) => [row.id, row]));
    for (const [id, row] of afterById) {
      if (!beforeById.has(id) || JSON.stringify(beforeById.get(id)) !== JSON.stringify(row)) ids.add(id);
    }
    for (const id of beforeById.keys()) if (!afterById.has(id)) removedIds.add(id);
  }
  return { ids: [...ids], removedIds: [...removedIds] };
}

function runWorkingValidator() {
  const result = spawnSync(process.execPath, [resolve("research", "validate.mjs")], {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  const text = String(result.status === 0 ? result.stdout : (result.stderr || result.stdout)).trim();
  let payload = null;
  try { payload = JSON.parse(text); } catch {}
  return {
    ok: result.status === 0,
    errors: Array.isArray(payload?.errors) ? payload.errors : result.status === 0 ? [] : [text || "validation failed"],
    warnings: Array.isArray(payload?.warnings) ? payload.warnings : [],
  };
}

function advisoryFindings(events, articles) {
  if (!events.length) return [];
  const findings = [];
  const append = (kind, result) => {
    for (const candidate of result.candidates || []) {
      findings.push({ kind, reviewOnly: true, ...candidate });
    }
  };
  append("chronology", checkTimelineChronology(events, articles));
  append("humanitarian", checkHumanitarianSummaryRisk(events, articles));
  append("time-support", checkTimelineTimeSupport(events, articles, { limit: 100 }));
  append("time-provenance", checkTimelineTimeProvenance(events, articles));
  return findings;
}

async function review(args) {
  const requestedId = args.find((value) => !value.startsWith("--")) || "";
  const validation = runWorkingValidator();
  const registry = await loadArticleRegistry(dataRoot);
  const allTimeline = [];
  for (const file of await listFiles(join(dataRoot, "timeline"), ".jsonl")) {
    allTimeline.push(...await readJsonl(file));
  }

  let changedPaths = [];
  let timelineIds = [];
  let removedTimelineIds = [];
  let events = [];
  let target = null;

  if (requestedId) {
    target = await loadRecordInspection(requestedId, { cwd: process.cwd(), dataRoot });
    if (target.kind === "timeline") events = [target.record];
    else if (target.kind === "current") events = target.evidence.timeline || [];
  } else {
    let baseRef = "HEAD";
    const runtimePath = resolve(".work", "CYCLE_RUN.json");
    if (existsSync(runtimePath)) {
      const runtime = await readJson(runtimePath);
      if (runtime.baseHead) baseRef = String(runtime.baseHead);
    }
    changedPaths = gitOutput(["diff", "--name-only", baseRef, "--", "data"])
      .split(/\r?\n/u).map((value) => value.trim()).filter(Boolean);
    const changed = changedTimelineIds(baseRef, changedPaths);
    timelineIds = changed.ids;
    removedTimelineIds = changed.removedIds;
    const wanted = new Set(timelineIds);
    events = allTimeline.filter(({ id }) => wanted.has(id));
  }

  const advisories = advisoryFindings(events, registry.articles);
  const output = {
    ok: validation.ok,
    readOnly: true,
    scope: requestedId ? { recordId: requestedId, kind: target.kind } : {
      changedPaths,
      changedTimelineIds: timelineIds,
      removedTimelineIds,
    },
    blockers: validation.errors,
    warnings: validation.warnings,
    advisories,
    nextAction: !validation.ok
      ? "Fix the objective blockers, then rerun review or finish."
      : advisories.length
        ? "Review advisory findings against source evidence; they do not require a change if your judgment says the record is already correct."
        : "No objective blockers or targeted advisory findings were found. Continue research if it can still materially improve the record; otherwise finish.",
  };
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  if (!validation.ok) process.exitCode = 1;
}

async function captureChanged(baseRef) {
  if (!baseRef) throw new Error("capture-changed requires a base Git ref");
  const results = await captureChangedArticles(baseRef, { dataRoot });
  const identityConflicts = results.filter(({ status }) => status === "identity-conflict");
  const failures = results.filter(({ status }) => !["captured-html", "captured-document", "captured-text"].includes(status));
  process.stdout.write(JSON.stringify({
    ok: identityConflicts.length === 0,
    count: results.length,
    failures: failures.length,
    identityConflicts: identityConflicts.length,
    results,
  }, null, 2) + "\n");
  if (identityConflicts.length) process.exitCode = 3;
}

async function archiveVerify(id) {
  if (!id) throw new Error("archive-verify requires an article id");
  const result = await verifyArchiveCopy(id);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (!result.ok) process.exitCode = 1;
}

async function archiveRestore(id, destination = resolve(".work", "restored-evidence")) {
  if (!id) throw new Error("archive-restore requires an article id");
  const result = await restoreArchiveCopy(id, destination);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (!result.ok) process.exitCode = 1;
}

async function reconstruct(id, ref = "HEAD") {
  if (!id) throw new Error("reconstruct requires an article id");
  const result = await reconstructArticle(id, { ref, repoRoot: process.cwd() });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (!result.canonical) process.exitCode = 1;
}

async function checkTimes() {
  const registry = await loadArticleRegistry(dataRoot);
  const timeline = [];
  for (const file of await listFiles(join(dataRoot, "timeline"), ".jsonl")) {
    timeline.push(...await readJsonl(file));
  }
  process.stdout.write(JSON.stringify({
    ...summarizeTimelineTimes(timeline),
    storedEvidenceTimeSupport: checkTimelineTimeSupport(timeline, registry.articles),
  }, null, 2) + "\n");
}

async function checkTimeProvenance() {
  const registry = await loadArticleRegistry(dataRoot);
  const timeline = [];
  for (const file of await listFiles(join(dataRoot, "timeline"), ".jsonl")) {
    timeline.push(...await readJsonl(file));
  }
  process.stdout.write(JSON.stringify(checkTimelineTimeProvenance(timeline, registry.articles), null, 2) + "\n");
}

async function checkChronology() {
  const registry = await loadArticleRegistry(dataRoot);
  const timeline = [];
  for (const file of await listFiles(join(dataRoot, "timeline"), ".jsonl")) {
    timeline.push(...await readJsonl(file));
  }
  process.stdout.write(JSON.stringify(checkTimelineChronology(timeline, registry.articles), null, 2) + "\n");
}

async function checkHumanitarian() {
  const registry = await loadArticleRegistry(dataRoot);
  const timeline = [];
  for (const file of await listFiles(join(dataRoot, "timeline"), ".jsonl")) {
    timeline.push(...await readJsonl(file));
  }
  process.stdout.write(JSON.stringify(checkHumanitarianSummaryRisk(timeline, registry.articles), null, 2) + "\n");
}

async function checkReferences() {
  const registry = await loadArticleRegistry(dataRoot);
  const timeline = [];
  for (const file of await listFiles(join(dataRoot, "timeline"), ".jsonl")) {
    timeline.push(...await readJsonl(file));
  }
  const current = {};
  for (const name of ["summary", "thailand", "cambodia", "impact"]) {
    current[name] = await readJson(join(dataRoot, "current", `${name}.json`));
  }
  process.stdout.write(JSON.stringify(checkReferenceCoverage({
    articles: registry.articles,
    timeline,
    current,
  }), null, 2) + "\n");
}

async function show(id) {
  if (!id) throw new Error("show requires a stable record id");
  const packet = await loadRecordInspection(id, { cwd: process.cwd(), dataRoot });
  process.stdout.write(JSON.stringify(packet, null, 2) + "\n");
}

async function captured(id) {
  if (!id) throw new Error("captured requires a stable record id");
  const packet = await loadRecordInspection(id, { cwd: process.cwd(), dataRoot });
  const capturedPacket = packet.kind === "news"
    ? { ...packet, evidence: { ...packet.evidence, articles: [packet.record] } }
    : packet;
  process.stdout.write(JSON.stringify(await buildCapturedEvidence(capturedPacket), null, 2) + "\n");
}

async function finish(hoursText, reasonParts) {
  const nextAction = "Stop tool use and return the cycle outcome now. If any command failed, search looped, or other harness friction required recovery, include one concrete HARNESS_FEEDBACK: line; otherwise omit it. The runner handles final verification.";
  const failInput = (error, usage = "node research/cli.mjs finish <hours> <reason>") => {
    process.stderr.write(JSON.stringify({
      ok: false,
      error,
      usage,
      nextAction: "Choose the required cadence/reason and rerun finish directly. finish validates working data automatically; do not inspect CLI source or run validation separately.",
    }, null, 2) + "\n");
    process.exitCode = 2;
  };
  const cycleRuntimePath = resolve(".work", "CYCLE_RUN.json");
  if (!existsSync(cycleRuntimePath)) {
    throw new Error("finish is only available inside a runner cycle");
  }
  const cycleRuntime = await readJson(cycleRuntimePath);
  const cycleId = String(cycleRuntime.runId || "").trim();
  if (!cycleId) throw new Error("cycle metadata is missing runId");
  const finishMarkerPath = resolve(".work", "research-finish.json");
  if (existsSync(finishMarkerPath)) {
    const marker = await readJson(finishMarkerPath);
    if (marker.cycleId === cycleId && marker.decision !== "review") {
      process.stdout.write(JSON.stringify({ ...marker, alreadyFinished: true, nextAction }) + "\n");
      return;
    }
    if (marker.cycleId === cycleId && marker.decision === "review" && hoursText === "--review") {
      process.stdout.write(JSON.stringify({ ...marker, alreadyFinished: true, nextAction }) + "\n");
      return;
    }
  }

  if (hoursText === "--review") {
    const reason = reasonParts.join(" ").trim();
    if (!reason) {
      failInput("review reason is required", "node research/cli.mjs finish --review <reason>");
      return;
    }
    if (reason.length > 240) {
      failInput("review reason must be at most 240 characters", "node research/cli.mjs finish --review <reason>");
      return;
    }
    const marker = {
      cycleId,
      decision: "review",
      reason,
      requestedAt: Date.now(),
    };
    await writeJson(finishMarkerPath, marker);
    process.stdout.write(JSON.stringify({ ...marker, nextAction }) + "\n");
    return;
  }

  if (hoursText == null) {
    failInput(`finish needs cadence and reason; hours must be 1-${MAX_SCHEDULE_HOURS}`);
    return;
  }
  const requestedHours = Number(hoursText);
  const hours = Number.isFinite(requestedHours) ? requestedHours : Number.NaN;
  if (!Number.isFinite(hours) || hours < 1 || hours > MAX_SCHEDULE_HOURS) {
    failInput(`finish hours must be between 1 and ${MAX_SCHEDULE_HOURS}`);
    return;
  }
  const suppliedReason = reasonParts.join(" ").trim();
  if (!suppliedReason) {
    failInput("finish reason is required for every completed cycle");
    return;
  }
  if (suppliedReason.length > 240) {
    failInput("finish reason must be at most 240 characters");
    return;
  }
  validateWorkingDataBeforeFinish();
  const marker = {
    cycleId,
    decision: "complete",
    intervalHours: hours,
    reason: suppliedReason,
    requestedAt: Date.now(),
  };
  await writeJson(finishMarkerPath, marker);
  process.stdout.write(JSON.stringify({ ...marker, nextAction }) + "\n");
}

function renderHelp(topic = "") {
  if (topic === "source") {
    return [
      "source — inspect or retain article evidence",
      "",
      "Read-only:",
      "  node research/cli.mjs source <url> [preview-chars]",
      "  Resolves/fetches the URL, checks canonical/publisher identity, and reports existing matches.",
      "",
      "Retain:",
      "  node research/cli.mjs source add <json-or-jsonl-file> [--no-localize]",
      "  Safely adds or reuses a small evidence batch and captures publisher evidence.",
      "",
      "Candidate fields:",
      "  sourceUrl, source, category, title or titleEn,",
      "  mediaEnvironment: thailand-domestic | cambodia-domestic | international",
      "  status: active | archived | unverified",
      "  credibility: 0..100 in steps of 10 (unverified records cannot exceed 50)",
      "  publishedAt or fetchedAt: Unix milliseconds",
      "  provenanceId is optional.",
      "",
      "Example candidate:",
      '  {"sourceUrl":"https://publisher.example/a","source":"Publisher",',
      '   "category":"diplomatic","mediaEnvironment":"international",',
      '   "status":"active","credibility":80,"titleEn":"...",',
      '   "publishedAt":1790000000000}',
      "",
      "The tool owns URL identity, reuse, canonical placement, publisher-time reconciliation,",
      "stable article IDs, and capture. You own semantic judgments such as category,",
      "media environment, credibility, status, and whether the evidence belongs in the record.",
    ].join("\n");
  }
  if (topic === "record") {
    return [
      "record — understand one canonical record",
      "",
      "  node research/cli.mjs record <id>",
      "  node research/cli.mjs record <id> --captured",
      "",
      "Reads an article, timeline event, or current/{summary,thailand,cambodia,impact} record",
      "with resolved canonical evidence. --captured also returns retained publisher text.",
      "This command is read-only.",
    ].join("\n");
  }
  if (topic === "review") {
    return [
      "review — inspect changed work without making editorial decisions for you",
      "",
      "  node research/cli.mjs review",
      "  node research/cli.mjs review <record-id>",
      "",
      "Runs objective validation and relevant advisory diagnostics. With no ID, timeline",
      "diagnostics are limited to events changed in this cycle. Advisory findings never",
      "require a change by themselves. This command is read-only.",
    ].join("\n");
  }
  if (topic === "finish") {
    return [
      "finish — complete the research decision",
      "",
      "  node research/cli.mjs finish <hours> <reason>",
      "  node research/cli.mjs finish --review <reason>",
      "",
      "Validates working canonical data and records your next-cadence judgment.",
      "The trusted runner owns final verification, scheduler-state advancement, and publication.",
    ].join("\n");
  }
  if (topic === "advanced") {
    return [
      "Advanced diagnostics, compatibility, and recovery:",
      "  ingest <file> [--no-localize]   compatibility alias for source add",
      "  probe-source <url> [chars]      low-level source probe",
      "  show <id> / captured <id>       compatibility record inspection",
      "  capture <id> [--force]          retry stored evidence capture",
      "  sync-news-localization          maintain visible-news localization window",
      "  capture-changed [base-ref]      capture manually edited news records",
      "  archive-verify / archive-restore",
      "  reconstruct <id> [git-ref]",
      "  check-times / check-time-provenance / check-chronology / check-humanitarian",
      "  check-references",
      "",
      "These are targeted instruments, not a routine checklist.",
    ].join("\n");
  }
  return [
    "BorderClash research tools:",
    "  source <url>                    understand a source (read-only)",
    "  source add <file>               retain or reuse article evidence",
    "  record <id> [--captured]        understand a canonical record and its evidence",
    "  review [id]                     inspect changed work or one record",
    "  finish <hours> <reason>         complete the cycle and choose next cadence",
    "  finish --review <reason>        stop for operator review when trustworthy completion is blocked",
    "  context                         show compact live orientation",
    "",
    "Use: node research/cli.mjs <command> --help",
    "Advanced/recovery: node research/cli.mjs --help advanced",
    "",
    "Routine cycles do not need pnpm validate/test/build; finish validates working data",
    "and the trusted runner performs final verification.",
  ].join("\n");
}

function run(name, args) {
  const result = spawnSync(name, args, {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function check() {
  run(process.execPath, [join("research", "validate.mjs")]);
  run("git", ["diff", "--check"]);
}

if (!existsSync(dataRoot)) {
  throw new Error("Run from the BorderClash research repository root.");
}

if (command === "brief") {
  process.stdout.write(JSON.stringify(await brief(), null, 2) + "\n");
} else if (command === "context") {
  process.stdout.write(renderContext(await brief()) + "\n");
} else if (command === "check") {
  check();
} else if (command === "source") {
  const args = process.argv.slice(3);
  if (args.includes("--help") || args.includes("-h")) process.stdout.write(renderHelp("source") + "\n");
  else await source(args);
} else if (command === "record") {
  const args = process.argv.slice(3);
  if (args.includes("--help") || args.includes("-h")) process.stdout.write(renderHelp("record") + "\n");
  else await record(args);
} else if (command === "review") {
  const args = process.argv.slice(3);
  if (args.includes("--help") || args.includes("-h")) process.stdout.write(renderHelp("review") + "\n");
  else await review(args);
} else if (command === "ingest") {
  const args = process.argv.slice(3);
  const path = args.find((arg) => arg !== "--no-localize");
  await ingest(path, { localize: !args.includes("--no-localize") });
} else if (command === "sync-news-localization") {
  await syncLocalization();
} else if (command === "capture") {
  await capture(process.argv[3], process.argv.includes("--force"));
} else if (command === "probe-source") {
  await probeSource(process.argv[3], process.argv[4]);
} else if (command === "capture-changed") {
  await captureChanged(process.argv[3]);
} else if (command === "archive-verify") {
  await archiveVerify(process.argv[3]);
} else if (command === "archive-restore") {
  await archiveRestore(process.argv[3], process.argv[4]);
} else if (command === "reconstruct") {
  await reconstruct(process.argv[3], process.argv[4] || "HEAD");
} else if (command === "check-times") {
  await checkTimes();
} else if (command === "check-time-provenance") {
  await checkTimeProvenance();
} else if (command === "check-chronology") {
  await checkChronology();
} else if (command === "check-humanitarian") {
  await checkHumanitarian();
} else if (command === "check-references") {
  await checkReferences();
} else if (command === "show") {
  await show(process.argv[3]);
} else if (command === "captured") {
  await captured(process.argv[3]);
} else if (command === "finish") {
  if (process.argv.includes("--help") || process.argv.includes("-h")) process.stdout.write(renderHelp("finish") + "\n");
  else await finish(process.argv[3], process.argv.slice(4));
} else if (["help", "--help", "-h"].includes(command)) {
  process.stdout.write(renderHelp(process.argv[3] || "") + "\n");
} else {
  console.error("Unknown research command. Run: node research/cli.mjs --help");
  process.exit(2);
}
