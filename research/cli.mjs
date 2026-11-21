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
  const state = await readJson(join(dataRoot, "research-state.json"));

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
  const guide = readFileSync(resolve("research", "CYCLE_GUIDE.md"), "utf8").trim();
  const lines = [
    "# BorderClash research cycle",
    "",
    guide,
    "",
    "## Live",
    `Now: ${output.cycle.now}`,
    `Last: ${output.cycle.since || "unknown"} (cycle ${output.cycle.count})`,
    "Data: data/current/{summary,thailand,cambodia,impact}.json; data/{timeline,news}/YYYY-MM.jsonl",
  ];

  lines.push(
    "",
    "## Recent anchors",
    `${output.contextWindow.lookbackDays}d ${output.contextWindow.start}..${output.contextWindow.end}${output.contextWindow.cappedAt30Days ? " (30d cap)" : ""}; orientation, not rank/quota.`,
    "",
    "Timeline:",
  );

  for (const row of output.recentTimeline.slice(0, 5)) {
    lines.push(`- ${row.date} ${row.timeOfDay || ""} [${row.id}] ${row.title}`.trim());
  }
  if (!output.recentTimeline.length) lines.push("- none");

  lines.push("", "Evidence:");
  for (const [label, key] of [["TH", "thailand"], ["KH", "cambodia"], ["INTL", "international"]]) {
    const rows = output.recentNews[key].slice(0, 1);
    if (!rows.length) {
      lines.push(`- ${label}: none`);
      continue;
    }
    for (const row of rows) {
      lines.push(`- ${label} ${borderLocalDate(row.publishedAt || row.fetchedAt)} [${row.id}] ${row.source}: ${row.title}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

async function ingest(path, { localize = true } = {}) {
  if (!path) throw new Error("ingest requires a JSON or JSONL candidate file");
  const candidates = await readCandidateFile(resolve(path));
  if (!Array.isArray(candidates) || candidates.length === 0) throw new Error("ingest candidate file is empty");
  const results = await ingestCandidates(candidates, { dataRoot });
  const localization = localize
    ? await syncNewsLocalization(dataRoot)
    : { skipped: true };
  process.stdout.write(JSON.stringify({ ok: true, count: results.length, results, localization }, null, 2) + "\n");
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
  const nextAction = "Return your final response with the cycle outcome. Include HARNESS_FEEDBACK when you have useful harness feedback.";
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
    if (!reason) throw new Error("review reason is required");
    if (reason.length > 240) throw new Error("review reason must be at most 240 characters");
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
    throw new Error("finish requires an explicit cadence and reason: finish <hours> <reason>");
  }
  const requestedHours = Number(hoursText);
  const hours = Number.isFinite(requestedHours) ? requestedHours : Number.NaN;
  if (!Number.isFinite(hours) || hours < 1 || hours > MAX_SCHEDULE_HOURS) {
    throw new Error(`finish hours must be between 1 and ${MAX_SCHEDULE_HOURS}`);
  }
  const suppliedReason = reasonParts.join(" ").trim();
  if (!suppliedReason) {
    throw new Error("finish reason is required for every completed cycle");
  }
  if (suppliedReason.length > 240) {
    throw new Error("finish reason must be at most 240 characters");
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
  await finish(process.argv[3], process.argv.slice(4));
} else if (["help", "--help", "-h"].includes(command)) {
  process.stdout.write([
    "node research/cli.mjs [context]          # show the compact cycle context",
    "node research/cli.mjs ingest <file> [--no-localize] # add/reuse article evidence; optionally skip unrelated localization sync",
    "node research/cli.mjs sync-news-localization # strip stale localized titles outside the newest visible domestic window",
    "node research/cli.mjs capture <id> [--force] # capture or retry one stored article",
    "node research/cli.mjs capture-changed [base-ref] # capture changed news records; hold publisher-ID alias conflicts for review",
    "node research/cli.mjs probe-source <url> [preview-chars] # host/operator network diagnostic; AGY terminal sandbox can block it",
    "node research/cli.mjs archive-verify <id>    # verify the South-local backup copy by checksum",
    "node research/cli.mjs archive-restore <id> [destination] # restore one backup to a review directory",
    "node research/cli.mjs reconstruct <id> [git-ref] # show one historical canonical record with its private capture metadata",
    "node research/cli.mjs show <id>           # show one canonical record with resolved evidence",
    "node research/cli.mjs captured <id>       # show retained publisher text for cited evidence",
    "node research/cli.mjs check-times        # inspect exact/date-only times and stored-evidence support",
    "node research/cli.mjs check-time-provenance # flag exact times that may mirror publication metadata",
    "node research/cli.mjs check-chronology   # flag retrospective evidence with suspicious event dates",
    "node research/cli.mjs check-humanitarian # triage single-source humanitarian numeric mismatches",
    "node research/cli.mjs check-references   # report unresolved canonical evidence references",
    "node research/cli.mjs finish <hours> <reason>  # complete cycle and choose next cadence",
    "node research/cli.mjs finish --review <reason> # stop for operator review without publication",
  ].join("\n") + "\n");
} else {
    console.error("Usage: node research/cli.mjs [brief|context|check|ingest|sync-news-localization|capture|probe-source|capture-changed|archive-verify|archive-restore|reconstruct|show|captured|check-times|check-time-provenance|check-chronology|check-humanitarian|check-references|finish]");
  process.exit(2);
}
