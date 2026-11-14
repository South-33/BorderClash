import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { newsEnvironmentKey, selectVisibleNews } from "./lib/news.mjs";
import { listFiles, readJson, readJsonl, writeJson } from "./lib/files.mjs";
import { militaryAssessmentFor } from "./lib/military-assessment.mjs";
import { evidenceRubricPrompt } from "./lib/evidence-score.mjs";
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
import { reconstructArticle } from "./lib/reconstruct.mjs";
import { summarizeTimelineTimes } from "./lib/timeline-audit.mjs";
import { auditTimelineChronology } from "./lib/chronology-audit.mjs";
import { auditHumanitarianSummaryRisk } from "./lib/humanitarian-audit.mjs";
import { auditReferenceCoverage } from "./lib/reference-audit.mjs";
import { buildAuditPacket } from "./lib/audit-packet.mjs";
import {
  auditLedgerSummary,
  createAuditLedger,
  loadAuditRecords,
  markAuditItem,
  nextAuditItems,
  syncAuditLedger,
  writeAuditLedger,
} from "./lib/audit-ledger.mjs";

const dataRoot = resolve("data");
const command = process.argv[2] || "context";
const DAY_MS = 24 * 3_600_000;
const BRIEF_MIN_DAYS = 7;
const BRIEF_MAX_DAYS = 30;
const BRIEF_NEWS_LIMIT = 6;
const BRIEF_TIMELINE_LIMIT = 12;
const SOURCE_MIX_RECORDS = 20;
const MAX_SCHEDULE_HOURS = 168;

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
  const parsed = Date.parse(`${row.date}T${time}:00Z`);
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
  const sourceMix = Object.fromEntries(
    Object.entries(eligibleNews).map(([environment, rows]) => {
      const counts = new Map();
      for (const row of rows.slice(0, SOURCE_MIX_RECORDS)) {
        const source = String(row.source || "unknown").trim() || "unknown";
        counts.set(source, (counts.get(source) || 0) + 1);
      }
      return [
        environment,
        [...counts.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, 6)
          .map(([source, count]) => ({ source, count })),
      ];
    }),
  );
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
    sourceMix,
    sourceMixRecords: SOURCE_MIX_RECORDS,
    timeline: contextTimeline.slice(0, BRIEF_TIMELINE_LIMIT),
  };
}

async function brief() {
  const state = await readJson(join(dataRoot, "research-state.json"));
  const impact = await readJson(join(dataRoot, "current", "impact.json"));
  const current = Object.fromEntries(
    await Promise.all(
      ["thailand", "cambodia", "summary"].map(async (name) => [
        name,
        await readJson(join(dataRoot, "current", name + ".json")),
      ]),
    ),
  );

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
      next: toIso(state.nextRunAt),
      intervalHours: state.lastCycleInterval,
      reason: state.schedulingReason,
      count: state.researchCycleCount,
      paused: state.isPaused,
    },
    current: {
      impact: {
        displaced: impact.displaced,
        deaths: impact.deaths,
        updatedAt: impact.updatedAt,
      },
      thailand: {
        updatedAt: current.thailand?.updatedAt,
        militaryTier: current.thailand?.militaryAssessment?.tier,
        activityLabel: current.thailand?.activityLabel,
        summary: current.thailand?.summary,
      },
      cambodia: {
        updatedAt: current.cambodia?.updatedAt,
        militaryTier: current.cambodia?.militaryAssessment?.tier,
        activityLabel: current.cambodia?.activityLabel,
        summary: current.cambodia?.summary,
      },
      summary: {
        updatedAt: current.summary?.updatedAt,
        summary: current.summary?.summary,
        keyUpdates: current.summary?.keyUpdates,
      },
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
    sourceMix: context.sourceMix,
    sourceMixRecords: context.sourceMixRecords,
    archive: {
      timeline: timeline.length,
      news: Object.values(news).reduce((sum, values) => sum + values.length, 0),
    },
  };

  return output;
}

function isoDate(value) {
  return Number.isFinite(value) ? new Date(value).toISOString() : "unknown";
}

function compactMetric(metric) {
  if (!metric || metric.value == null) {
    return metric?.qualifier === "NO_COMBINED_TOTAL" ? "no combined total" : "unknown";
  }
  const prefix = metric.qualifier === "MORE_THAN"
    ? ">"
    : metric.qualifier === "AT_LEAST"
      ? ">="
      : "";
  return `${prefix}${metric.value}`;
}

function renderContext(output) {
  const lines = [
    "# BorderClash cycle context",
    "",
    "This is a snapshot of what the repository currently says, not verified truth. Use it for orientation and as a signal for what may need checking; inspect the repository, history, and web wherever useful.",
    "A no-change cycle is valid when the current record remains the best supported picture.",
    "",
    "## Cycle",
    `Research reference time: ${output.cycle.now}`,
    `Last completed: ${output.cycle.since || "unknown"} (cycle ${output.cycle.count})`,
    `Scheduled next: ${output.cycle.next || "unset"}`,
    `Previous cadence: ${output.cycle.intervalHours || "unknown"}h - ${output.cycle.reason || "no reason recorded"}`,
    "",
    "## Current repository state",
    `Impact: displaced ${compactMetric(output.current.impact.displaced)}; deaths ${compactMetric(output.current.impact.deaths)}`,
    `Thailand ${output.current.thailand.militaryTier || "unrated"}/${militaryAssessmentFor(output.current.thailand.militaryTier)?.score ?? "—"}: ${output.current.thailand.activityLabel || "unlabelled"}.`,
    `Cambodia ${output.current.cambodia.militaryTier || "unrated"}/${militaryAssessmentFor(output.current.cambodia.militaryTier)?.score ?? "—"}: ${output.current.cambodia.activityLabel || "unlabelled"}.`,
    `Summary: ${output.current.summary.summary || ""}`,
    "",
    "## Evidence scoring rubric",
    evidenceRubricPrompt(),
  ];

  const counts = output.contextWindow.counts;
  const since = output.contextWindow.sinceLastCycleCounts;
  lines.push(
    "",
    "## Recent repository context",
    `${output.contextWindow.lookbackDays} days from ${output.contextWindow.start} to ${output.contextWindow.end}${output.contextWindow.cappedAt30Days ? " (automatic context capped at 30 days)" : ""}.`,
    `In context: timeline ${counts.timeline}; news Thailand domestic ${counts.news.thailand}, Cambodia domestic ${counts.news.cambodia}, international ${counts.news.international}.`,
    `Since last completed cycle: timeline ${since.timeline}; news Thailand domestic ${since.news.thailand}, Cambodia domestic ${since.news.cambodia}, international ${since.news.international}.`,
    "",
    "## Recent timeline anchors",
  );

  for (const row of output.recentTimeline.slice(0, 5)) {
    lines.push(`- ${row.date} ${row.timeOfDay || ""} [${row.id}] ${row.title}`.trim());
  }
  if (!output.recentTimeline.length) lines.push("- none");

  lines.push("", "## Latest retained evidence anchors");
  for (const [label, key] of [["Thailand domestic", "thailand"], ["Cambodia domestic", "cambodia"], ["International", "international"]]) {
    lines.push(`${label}:`);
    const rows = output.recentNews[key].slice(0, 3);
    if (!rows.length) {
      lines.push("- none");
      continue;
    }
    for (const row of rows) {
      lines.push(`- ${isoDate(row.publishedAt || row.fetchedAt).slice(0, 10)} [${row.id}] ${row.source}: ${row.title}`);
    }
  }

  lines.push("", `## Source mix across the latest ${output.sourceMixRecords || SOURCE_MIX_RECORDS} visible records per environment (context, not a quota)`);
  for (const [label, key] of [["Thailand domestic", "thailand"], ["Cambodia domestic", "cambodia"], ["International", "international"]]) {
    const mix = output.sourceMix?.[key] || [];
    lines.push(`${label}: ${mix.length ? mix.map(({ source, count }) => `${source} (${count})`).join(", ") : "none"}`);
  }

  lines.push(
    "",
    `Archive: ${output.archive.timeline} timeline events; ${output.archive.news} news records.`,
    "Finish when the record is in the best state the evidence supports: `pnpm research finish`. Commands: `pnpm research --help`.",
    "",
  );
  return lines.join("\n");
}

async function ingest(path) {
  if (!path) throw new Error("ingest requires a JSON or JSONL candidate file");
  const candidates = await readCandidateFile(resolve(path));
  if (!Array.isArray(candidates) || candidates.length === 0) throw new Error("ingest candidate file is empty");
  const results = await ingestCandidates(candidates, { dataRoot });
  process.stdout.write(JSON.stringify({ ok: true, count: results.length, results }, null, 2) + "\n");
}

async function capture(id, force = false) {
  if (!id) throw new Error("capture requires an article id");
  const registry = await loadArticleRegistry(dataRoot);
  const article = registry.byId.get(id);
  if (!article) throw new Error(`unknown article id: ${id}`);
  const result = await captureArticle(article, { force });
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

async function auditTimes() {
  const timeline = [];
  for (const file of await listFiles(join(dataRoot, "timeline"), ".jsonl")) {
    timeline.push(...await readJsonl(file));
  }
  process.stdout.write(JSON.stringify(summarizeTimelineTimes(timeline), null, 2) + "\n");
}

async function auditChronology() {
  const registry = await loadArticleRegistry(dataRoot);
  const timeline = [];
  for (const file of await listFiles(join(dataRoot, "timeline"), ".jsonl")) {
    timeline.push(...await readJsonl(file));
  }
  process.stdout.write(JSON.stringify(auditTimelineChronology(timeline, registry.articles), null, 2) + "\n");
}

async function auditHumanitarian() {
  const registry = await loadArticleRegistry(dataRoot);
  const timeline = [];
  for (const file of await listFiles(join(dataRoot, "timeline"), ".jsonl")) {
    timeline.push(...await readJsonl(file));
  }
  process.stdout.write(JSON.stringify(auditHumanitarianSummaryRisk(timeline, registry.articles), null, 2) + "\n");
}

async function auditReferences() {
  const registry = await loadArticleRegistry(dataRoot);
  const timeline = [];
  for (const file of await listFiles(join(dataRoot, "timeline"), ".jsonl")) {
    timeline.push(...await readJsonl(file));
  }
  const current = {};
  for (const name of ["summary", "thailand", "cambodia", "impact"]) {
    current[name] = await readJson(join(dataRoot, "current", `${name}.json`));
  }
  process.stdout.write(JSON.stringify(auditReferenceCoverage({
    articles: registry.articles,
    timeline,
    current,
  }), null, 2) + "\n");
}

async function auditShow(id) {
  if (!id) throw new Error("audit-show requires a stable record id");
  const registry = await loadArticleRegistry(dataRoot);
  const timeline = [];
  for (const file of await listFiles(join(dataRoot, "timeline"), ".jsonl")) {
    timeline.push(...await readJsonl(file));
  }
  const current = {};
  for (const name of ["summary", "thailand", "cambodia", "impact"]) {
    current[name] = await readJson(join(dataRoot, "current", `${name}.json`));
  }
  process.stdout.write(JSON.stringify(buildAuditPacket({
    id,
    articles: registry.articles,
    timeline,
    current,
  }), null, 2) + "\n");
}

const defaultAuditLedgerPath = resolve(".work", "audit-ledger.json");

function gitText(args) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || "git failed").trim());
  return result.stdout.trim();
}

async function auditInit(ref = "HEAD", path = defaultAuditLedgerPath) {
  const commit = gitText(["rev-parse", ref]);
  const diff = spawnSync("git", ["diff", "--quiet", commit, "--", "data"], { cwd: process.cwd(), windowsHide: true });
  if (diff.status !== 0) throw new Error("audit-init requires canonical data to match the anchor Git revision");
  const untracked = gitText(["ls-files", "--others", "--exclude-standard", "--", "data"]);
  if (untracked) throw new Error("audit-init requires no untracked canonical data");
  const ledger = createAuditLedger(await loadAuditRecords(dataRoot), { anchorCommit: commit });
  await writeAuditLedger(resolve(path), ledger);
  process.stdout.write(JSON.stringify(auditLedgerSummary(ledger), null, 2) + "\n");
}

async function readAuditLedger(path = defaultAuditLedgerPath) {
  return readJson(resolve(path));
}

async function auditStatus(path = defaultAuditLedgerPath) {
  process.stdout.write(JSON.stringify(auditLedgerSummary(await readAuditLedger(path)), null, 2) + "\n");
}

async function auditNext(limitText = "25", path = defaultAuditLedgerPath) {
  const ledger = await readAuditLedger(path);
  process.stdout.write(JSON.stringify(nextAuditItems(ledger, Number(limitText)), null, 2) + "\n");
}

async function auditMark(id, status, noteParts) {
  if (!id || !status) throw new Error("audit-mark requires <id> <status> [note]");
  const ledger = await readAuditLedger();
  const item = markAuditItem(ledger, id, status, noteParts.join(" "));
  await writeAuditLedger(defaultAuditLedgerPath, ledger);
  process.stdout.write(JSON.stringify(item, null, 2) + "\n");
}

async function auditSync(ref = "HEAD", path = defaultAuditLedgerPath) {
  const ledger = await readAuditLedger(path);
  const commit = gitText(["rev-parse", ref]);
  syncAuditLedger(ledger, await loadAuditRecords(dataRoot), { commit });
  await writeAuditLedger(resolve(path), ledger);
  process.stdout.write(JSON.stringify(auditLedgerSummary(ledger), null, 2) + "\n");
}

async function finish(hoursText, reasonParts) {
  const statePath = join(dataRoot, "research-state.json");
  const state = await readJson(statePath);
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
      process.stdout.write(JSON.stringify({ ...marker, alreadyFinished: true }) + "\n");
      return;
    }
    if (marker.cycleId === cycleId && marker.decision === "review" && hoursText === "--review") {
      process.stdout.write(JSON.stringify({ ...marker, alreadyFinished: true }) + "\n");
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
    process.stdout.write(JSON.stringify(marker) + "\n");
    return;
  }

  const requestedHours = hoursText == null ? Number(state.lastCycleInterval || 24) : Number(hoursText);
  const hours = Number.isFinite(requestedHours) ? requestedHours : Number.NaN;
  if (!Number.isFinite(hours) || hours < 1 || hours > MAX_SCHEDULE_HOURS) {
    throw new Error(`finish hours must be between 1 and ${MAX_SCHEDULE_HOURS}`);
  }
  const suppliedReason = reasonParts.join(" ").trim();
  if (suppliedReason.length > 240) {
    throw new Error("finish reason must be at most 240 characters");
  }
  const previousHours = Number(state.lastCycleInterval || 24);
  if (hours !== previousHours && !suppliedReason) {
    throw new Error("finish reason is required when changing cadence");
  }
  const marker = {
    cycleId,
    decision: "complete",
    intervalHours: hours,
    reason: suppliedReason || String(state.schedulingReason || "Research cycle completed.").trim(),
    requestedAt: Date.now(),
  };
  await writeJson(finishMarkerPath, marker);
  process.stdout.write(JSON.stringify(marker) + "\n");
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
  await ingest(process.argv[3]);
} else if (command === "capture") {
  await capture(process.argv[3], process.argv.includes("--force"));
} else if (command === "capture-changed") {
  await captureChanged(process.argv[3]);
} else if (command === "archive-verify") {
  await archiveVerify(process.argv[3]);
} else if (command === "archive-restore") {
  await archiveRestore(process.argv[3], process.argv[4]);
} else if (command === "reconstruct") {
  await reconstruct(process.argv[3], process.argv[4] || "HEAD");
} else if (command === "audit-times") {
  await auditTimes();
} else if (command === "audit-chronology") {
  await auditChronology();
} else if (command === "audit-humanitarian") {
  await auditHumanitarian();
} else if (command === "audit-references") {
  await auditReferences();
} else if (command === "audit-show") {
  await auditShow(process.argv[3]);
} else if (command === "audit-init") {
  await auditInit(process.argv[3] || "HEAD", process.argv[4] || defaultAuditLedgerPath);
} else if (command === "audit-status") {
  await auditStatus(process.argv[3] || defaultAuditLedgerPath);
} else if (command === "audit-next") {
  await auditNext(process.argv[3] || "25", process.argv[4] || defaultAuditLedgerPath);
} else if (command === "audit-mark") {
  await auditMark(process.argv[3], process.argv[4], process.argv.slice(5));
} else if (command === "audit-sync") {
  await auditSync(process.argv[3] || "HEAD", process.argv[4] || defaultAuditLedgerPath);
} else if (command === "finish") {
  await finish(process.argv[3], process.argv.slice(4));
} else if (command === "help" || command === "--help" || command === "-h") {
  process.stdout.write([
    "pnpm research [context]          # show the compact cycle context",
    "pnpm research ingest <file>      # add/reuse a small batch of article records and capture evidence",
    "pnpm research capture <id> [--force] # capture or retry one stored article",
    "pnpm research archive-verify <id>    # verify the South-local backup copy by checksum",
    "pnpm research archive-restore <id> [destination] # restore one backup to a review directory",
    "pnpm research reconstruct <id> [git-ref] # show one historical canonical record with its private capture metadata",
    "pnpm research audit-times         # inventory exact/date-only timeline times for source review",
    "pnpm research audit-chronology    # flag retrospective evidence whose publication date may have been copied to an event",
    "pnpm research audit-humanitarian  # triage single-source humanitarian events with dense numeric summary mismatches",
    "pnpm research audit-references    # report canonical evidence references and current source URLs outside the registry",
    "pnpm research audit-show <id>     # show one canonical record with resolved article/timeline evidence",
    "pnpm research audit-init [git-ref] # create the local full-record audit ledger",
    "pnpm research audit-next [limit]    # show the next prioritized pending records",
    "pnpm research audit-mark <id> <reviewed|corrected|merged|unresolved> [note] # record one audit result",
    "pnpm research audit-sync [git-ref]  # reopen changed/new records after upstream movement",
    "pnpm research audit-status          # summarize full-record audit progress",
    "pnpm research finish             # request completion; keep current cadence",
    "pnpm research finish <hours> <reason>  # complete cycle and change cadence",
    "pnpm research finish --review <reason> # stop for operator review without publication",
  ].join("\n") + "\n");
} else {
  console.error("Usage: pnpm research [brief|context|ingest|capture|archive-verify|archive-restore|reconstruct|audit-times|audit-chronology|audit-humanitarian|audit-references|audit-show|audit-init|audit-next|audit-mark|audit-sync|audit-status|finish]");
  process.exit(2);
}
