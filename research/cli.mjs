import { execFile, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { newsEnvironmentKey, selectVisibleNews } from "./lib/news.mjs";
import { listFiles, readJson, readJsonl, writeJson } from "./lib/files.mjs";
import { militaryAssessmentFor } from "./lib/military-assessment.mjs";
import { syncNewsLocalization } from "./lib/news-localization.mjs";
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
import { probeEvidenceUrl } from "./lib/evidence-probe.mjs";
import { reconstructArticle } from "./lib/reconstruct.mjs";
import { summarizeTimelineTimes } from "./lib/timeline-audit.mjs";
import { auditTimelineTimeProvenance, auditTimelineTimeSupport } from "./lib/time-provenance-audit.mjs";
import { auditTimelineChronology } from "./lib/chronology-audit.mjs";
import { auditHumanitarianSummaryRisk } from "./lib/humanitarian-audit.mjs";
import { auditReferenceCoverage } from "./lib/reference-audit.mjs";
import { loadAuditPacketFromWorktree } from "./lib/audit-packet-loader.mjs";
import { buildAuditCluster } from "./lib/audit-cluster.mjs";
import { buildAuditCapturedEvidence } from "./lib/audit-captured-evidence.mjs";
import { buildAuditRiskQueue } from "./lib/audit-risk.mjs";
import { buildAuditPreparation } from "./lib/audit-prepare.mjs";
import { buildAuditEvidenceDiagnosis } from "./lib/audit-evidence-diagnosis.mjs";
import { recoverAuditEvidence } from "./lib/audit-evidence-recovery.mjs";
import {
  auditWorktreeNeedsConflictScan,
  auditWorktreeTimelineStatus,
  claimsFromTimelineDiff,
  createAuditClaim,
  createAuditClaims,
  loadAuditClaims,
  parseWorktreePorcelain,
  pickUnclaimedCandidates,
  releaseAuditClaim,
  shouldScanAuditWorktree,
} from "./lib/audit-worktree-claims.mjs";
import {
  loadAuditReviewIndex,
  reviewPacketIsCurrent,
  sha256Text,
} from "./lib/audit-result-index.mjs";
import {
  assertAuditRecordMatchesPrimary,
  auditLedgerSummary,
  createAuditLedger,
  loadAuditRecords,
  markAuditItem,
  nextAuditItems,
  syncAndMarkAuditItem,
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
const AUDIT_DIFF_CONCURRENCY = 12;
const execFileAsync = promisify(execFile);

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

function firstSentence(text) {
  const value = String(text || "").trim();
  const match = value.match(/^.*?[.!?](?:\s|$)/u);
  return match ? match[0].trim() : value;
}

function renderContext(output) {
  const lines = [
    "# BorderClash cycle context",
    "",
    "Repository claims, not verified truth. Verify sources and use the repository, history, or web as useful.",
    "A no-change cycle is valid.",
    "Canonical files: data/current/{impact,thailand,cambodia,summary}.json; data/news/YYYY-MM.jsonl; data/timeline/YYYY-MM.jsonl.",
    "News/cycle timestamps use Unix milliseconds; timeline date uses YYYY-MM-DD and optional timeOfDay uses supported local time.",
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
    `Overall: ${firstSentence(output.current.summary.summary)}`,
    "Current key updates (verify evidence):",
    ...output.current.summary.keyUpdates.slice(0, 4).map((item) => {
      const ids = Array.isArray(item.evidenceIds) ? item.evidenceIds.join(",") : "no-evidence-id";
      return `- [${ids}] ${item.text || ""}`;
    }),
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
    const rows = output.recentNews[key].slice(0, 1);
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
    const shown = mix.slice(0, 5);
    const remainder = mix.length > shown.length ? `, +${mix.length - shown.length} more` : "";
    lines.push(`${label}: ${shown.length ? shown.map(({ source, count }) => `${source} (${count})`).join(", ") + remainder : "none"}`);
  }

  lines.push(
    "",
    `Archive: ${output.archive.timeline} timeline events; ${output.archive.news} news records.`,
    "Terminal HTTP is sandboxed; use web tools. EAI_AGAIN from probe-source does not prove publisher failure.",
    "Finish with `node research/cli.mjs finish`; help: `node research/cli.mjs --help`.",
    "",
  );
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

async function auditTimes() {
  const registry = await loadArticleRegistry(dataRoot);
  const timeline = [];
  for (const file of await listFiles(join(dataRoot, "timeline"), ".jsonl")) {
    timeline.push(...await readJsonl(file));
  }
  process.stdout.write(JSON.stringify({
    ...summarizeTimelineTimes(timeline),
    storedEvidenceTimeSupport: auditTimelineTimeSupport(timeline, registry.articles),
  }, null, 2) + "\n");
}

async function auditTimeProvenance() {
  const registry = await loadArticleRegistry(dataRoot);
  const timeline = [];
  for (const file of await listFiles(join(dataRoot, "timeline"), ".jsonl")) {
    timeline.push(...await readJsonl(file));
  }
  process.stdout.write(JSON.stringify(auditTimelineTimeProvenance(timeline, registry.articles), null, 2) + "\n");
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
  const packet = await loadAuditPacket(id);
  process.stdout.write(JSON.stringify(packet, null, 2) + "\n");
}

async function loadAuditPacket(id) {
  return loadAuditPacketFromWorktree(id, {
    cwd: process.cwd(),
    dataRoot,
  });
}

async function auditCaptured(id) {
  if (!id) throw new Error("audit-captured requires a stable record id");
  const packet = await loadAuditPacket(id);
  const capturedPacket = packet.kind === "news"
    ? { ...packet, evidence: { ...packet.evidence, articles: [packet.record] } }
    : packet;
  process.stdout.write(JSON.stringify(await buildAuditCapturedEvidence(capturedPacket), null, 2) + "\n");
}

function compactAuditRecord(packet) {
  if (packet.proposedAction === "delete") {
    const record = packet.baselineRecord || {};
    return {
      id: packet.id,
      deleted: true,
      baseline: {
        date: record.date,
        timeOfDay: record.timeOfDay,
        title: record.title,
        evidenceIds: record.evidenceIds || [],
      },
    };
  }
  const record = packet.record || {};
  if (packet.kind === "timeline") {
    return {
      id: record.id,
      date: record.date,
      timeOfDay: record.timeOfDay,
      title: record.title,
      evidenceIds: record.evidenceIds || [],
    };
  }
  if (packet.kind === "news") {
    return {
      id: record.id,
      publishedAt: record.publishedAt,
      source: record.source,
      title: record.titleEn || record.title,
      sourceUrl: record.sourceUrl,
    };
  }
  return {
    updatedAt: record.updatedAt,
    summary: record.summary,
  };
}

async function auditResume(id) {
  if (!id) throw new Error("audit-resume requires a stable record id");
  const packet = await loadAuditPacket(id);
  const packetText = JSON.stringify(packet, null, 2) + "\n";
  const capturedPacket = packet.kind === "news"
    ? { ...packet, evidence: { ...packet.evidence, articles: [packet.record] } }
    : packet;
  const captured = await buildAuditCapturedEvidence(capturedPacket);
  const capturedText = JSON.stringify(captured, null, 2) + "\n";
  const latestReview = loadAuditReviewIndex(id);
  const reviewIndex = latestReview.index;
  const packetCurrent = latestReview.found && reviewPacketIsCurrent(reviewIndex, packetText);
  const capturedCurrent = latestReview.found
    && String(reviewIndex?.capturedEvidenceSha256 || "").toLowerCase() === sha256Text(capturedText);
  const head = gitText(["rev-parse", "HEAD"]);
  const worktreePath = gitText(["rev-parse", "--show-toplevel"]);
  const primary = primaryWorktreeInfo();
  const dataStatus = gitText(["status", "--porcelain", "--untracked-files=all", "--", "data"]);

  let ledgerItem = null;
  const sharedLedgerPath = primary.path
    ? resolve(primary.path, ".work", "audit-ledger.json")
    : defaultAuditLedgerPath;
  if (existsSync(sharedLedgerPath)) {
    const ledger = await readAuditLedger(sharedLedgerPath);
    ledgerItem = ledger.items.find((item) => item.id === id) || null;
  }

  const verificationPath = resolve(
    ".work",
    "correction-verifications",
    "by-target",
    `${head}.json`,
  );
  const verification = existsSync(verificationPath) ? await readJson(verificationPath) : null;

  process.stdout.write(JSON.stringify({
    recordId: id,
    head,
    dataDirty: Boolean(dataStatus),
    worktree: {
      path: worktreePath,
      primaryPath: primary.path,
      primaryHead: primary.head,
      isPrimary: resolve(worktreePath).toLowerCase() === resolve(primary.path || worktreePath).toLowerCase(),
      primaryMoved: Boolean(primary.head) && primary.head !== head,
    },
    canonical: {
      kind: packet.kind,
      proposedAction: packet.proposedAction || null,
      record: compactAuditRecord(packet),
    },
    ledger: ledgerItem && {
      status: ledgerItem.status,
      note: ledgerItem.note || "",
      present: ledgerItem.present,
    },
    review: latestReview.found ? {
      found: true,
      current: packetCurrent && capturedCurrent,
      packetCurrent,
      capturedEvidenceCurrent: capturedCurrent,
      path: latestReview.path,
      completedAt: reviewIndex.completedAt,
      repoHead: reviewIndex.repoHead,
      verdict: reviewIndex.review?.verdict,
      claimsSupported: reviewIndex.review?.claimsSupported,
      supportedEventDate: reviewIndex.review?.supportedEventDate,
      supportedEventTime: reviewIndex.review?.supportedEventTime,
      issues: reviewIndex.review?.issues || [],
    } : {
      found: false,
      current: false,
      path: latestReview.path,
    },
    verification: verification ? {
      found: true,
      headVerified: !dataStatus && verification.targetCommit === head && verification.ok === true,
      path: verificationPath,
      ok: verification.ok,
      finishedAt: verification.finishedAt,
      targetCommit: verification.targetCommit,
      changedFiles: verification.changedFiles,
    } : {
      found: false,
      headVerified: false,
      path: verificationPath,
    },
  }, null, 2) + "\n");
}

async function auditCluster(id, windowText = "3", limitText = "8") {
  if (!id) throw new Error("audit-cluster requires a stable timeline id");
  const registry = await loadArticleRegistry(dataRoot);
  const timeline = [];
  for (const file of await listFiles(join(dataRoot, "timeline"), ".jsonl")) {
    timeline.push(...await readJsonl(file));
  }
  process.stdout.write(JSON.stringify(buildAuditCluster({
    id,
    timeline,
    articles: registry.articles,
    windowDays: Number(windowText),
    limit: Number(limitText),
  }), null, 2) + "\n");
}

async function auditPrepare(id, windowText = "3", limitText = "8") {
  if (!id) throw new Error("audit-prepare requires a stable timeline id");
  const registry = await loadArticleRegistry(dataRoot);
  const timeline = [];
  for (const file of await listFiles(join(dataRoot, "timeline"), ".jsonl")) {
    timeline.push(...await readJsonl(file));
  }
  const retryMissing = process.argv.includes("--retry-missing");
  const forceCapture = process.argv.includes("--force-capture");
  process.stdout.write(JSON.stringify(await buildAuditPreparation({
    id,
    timeline,
    articles: registry.articles,
    windowDays: Number(windowText),
    limit: Number(limitText),
    retryMissing,
    forceCapture,
    captureArticleFn: captureArticle,
  }), null, 2) + "\n");
}

async function auditDiagnose(id, windowText = "7", limitText = "8") {
  if (!id) throw new Error("audit-diagnose requires a stable timeline id");
  const registry = await loadArticleRegistry(dataRoot);
  const timeline = [];
  for (const file of await listFiles(join(dataRoot, "timeline"), ".jsonl")) {
    timeline.push(...await readJsonl(file));
  }
  process.stdout.write(JSON.stringify(await buildAuditEvidenceDiagnosis({
    id,
    timeline,
    articles: registry.articles,
    windowDays: Number(windowText),
    limit: Number(limitText),
  }), null, 2) + "\n");
}

async function auditRecover(id, windowText = "7", limitText = "8", attemptsText = "3") {
  if (!id) throw new Error("audit-recover requires a stable timeline id");
  const registry = await loadArticleRegistry(dataRoot);
  const timeline = [];
  for (const file of await listFiles(join(dataRoot, "timeline"), ".jsonl")) {
    timeline.push(...await readJsonl(file));
  }
  process.stdout.write(JSON.stringify(await recoverAuditEvidence({
    id,
    timeline,
    articles: registry.articles,
    windowDays: Number(windowText),
    limit: Number(limitText),
    maxAttempts: Number(attemptsText),
    forceCapture: process.argv.includes("--force-capture"),
    captureArticleFn: captureArticle,
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

function gitTextAt(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || "git failed").trim());
  return result.stdout;
}

async function gitTextAtAsync(cwd, args) {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    encoding: "utf8",
  });
  return String(stdout || "");
}

async function mapBatches(items, concurrency, worker) {
  const results = [];
  const width = Math.max(1, Number(concurrency) || 1);
  for (let index = 0; index < items.length; index += width) {
    results.push(...await Promise.all(items.slice(index, index + width).map(worker)));
  }
  return results;
}

function primaryWorktreeInfo() {
  const firstBlock = gitText(["worktree", "list", "--porcelain"])
    .split(/\r?\n\r?\n/u)[0]
    .split(/\r?\n/u);
  const pathLine = firstBlock.find((line) => line.startsWith("worktree ")) || "";
  const headLine = firstBlock.find((line) => line.startsWith("HEAD ")) || "";
  return {
    path: pathLine.slice("worktree ".length),
    head: headLine.slice("HEAD ".length),
  };
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
  if (!existsSync(path)) {
    process.stdout.write(JSON.stringify({
      initialized: false,
      nextAction: "Use audit-init to start a historical audit. Routine research cycles can continue without an audit ledger.",
    }, null, 2) + "\n");
    return;
  }
  process.stdout.write(JSON.stringify(auditLedgerSummary(await readAuditLedger(path)), null, 2) + "\n");
}

async function auditNext(limitText = "25", path = defaultAuditLedgerPath) {
  const ledger = await readAuditLedger(path);
  process.stdout.write(JSON.stringify(nextAuditItems(ledger, Number(limitText)), null, 2) + "\n");
}

async function auditRisk(limitText = "25", path = defaultAuditLedgerPath) {
  const ledger = await readAuditLedger(path);
  const registry = await loadArticleRegistry(dataRoot);
  const timeline = [];
  for (const file of await listFiles(join(dataRoot, "timeline"), ".jsonl")) {
    timeline.push(...await readJsonl(file));
  }
  process.stdout.write(JSON.stringify(buildAuditRiskQueue({
    ledger,
    timeline,
    articles: registry.articles,
    limit: Number(limitText),
  }), null, 2) + "\n");
}

function compactRiskCandidate(candidate) {
  return {
    id: candidate.id,
    date: candidate.date,
    timeOfDay: candidate.timeOfDay,
    importance: candidate.importance,
    title: candidate.title,
    riskScore: candidate.riskScore,
    signals: candidate.signals.map(({ code }) => code),
  };
}

async function auditPick(limitText = "10", scanLimitText = "60", { claim = false } = {}) {
  const limit = Math.max(1, Math.min(50, Number(limitText) || 10));
  const scanLimit = Math.max(limit, Math.min(200, Number(scanLimitText) || Math.max(60, limit * 4)));
  const primary = primaryWorktreeInfo();
  if (!primary.path || !primary.head) throw new Error("audit-pick could not resolve the primary worktree");
  const currentRoot = gitText(["rev-parse", "--show-toplevel"]);
  const isPrimary = resolve(currentRoot).toLowerCase() === resolve(primary.path).toLowerCase();
  if (claim && isPrimary) {
    throw new Error("audit-pick --claim requires an isolated linked worktree");
  }

  const primaryDataRoot = resolve(primary.path, "data");
  const ledger = await readJson(resolve(primary.path, ".work", "audit-ledger.json"));
  const registry = await loadArticleRegistry(primaryDataRoot);
  const timeline = [];
  for (const file of await listFiles(join(primaryDataRoot, "timeline"), ".jsonl")) {
    timeline.push(...await readJsonl(file));
  }
  const risk = buildAuditRiskQueue({
    ledger,
    timeline,
    articles: registry.articles,
    limit: scanLimit,
  });

  const worktrees = parseWorktreePorcelain(gitText(["worktree", "list", "--porcelain"]));
  const possibleScanTargets = worktrees.filter((entry) => shouldScanAuditWorktree(entry.path, primary.path));
  const claimRoot = resolve(primary.path, ".work", "audit-claims");
  const explicit = loadAuditClaims(claimRoot, worktrees.map(({ path }) => path));
  const primaryAncestorHeads = new Set(
    gitText(["rev-list", primary.head]).split(/\r?\n/u).map((line) => line.trim()).filter(Boolean),
  );
  const scanTargets = [];
  const failures = [];
  let skippedCleanAncestorWorktreeCount = 0;
  let ancestorTimelineStatusCheckCount = 0;
  for (const worktree of possibleScanTargets) {
    if (!primaryAncestorHeads.has(worktree.head)) {
      scanTargets.push(worktree);
      continue;
    }
    ancestorTimelineStatusCheckCount += 1;
    const timelineStatus = auditWorktreeTimelineStatus(worktree.path, (path) => gitTextAt(path, [
      "status",
      "--porcelain",
      "--untracked-files=all",
      "--",
      "data/timeline",
    ]));
    if (!timelineStatus.ok) {
      failures.push({
        worktree: worktree.path,
        error: timelineStatus.error || "git status unavailable",
      });
      continue;
    }
    const timelineDirty = timelineStatus.timelineDirty;
    if (auditWorktreeNeedsConflictScan({ head: worktree.head, primaryAncestorHeads, timelineDirty })) {
      scanTargets.push(worktree);
    } else {
      skippedCleanAncestorWorktreeCount += 1;
    }
  }
  const primaryRows = new Map(timeline.map((event) => [event.id, JSON.stringify(event)]));
  const candidatesByFile = new Map();
  for (const candidate of risk.candidates) {
    const month = String(candidate.date || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/u.test(month)) continue;
    const relativePath = join("data", "timeline", `${month}.jsonl`);
    if (!candidatesByFile.has(relativePath)) candidatesByFile.set(relativePath, []);
    candidatesByFile.get(relativePath).push(candidate);
  }
  const claims = [...explicit.claims];
  const diffTasks = [];
  for (const worktree of scanTargets) {
    if (!existsSync(worktree.path)) continue;
    try {
      const divergentByFile = new Map();
      for (const [relativePath, fileCandidates] of candidatesByFile) {
        const path = resolve(worktree.path, relativePath);
        if (!existsSync(path)) continue;
        const text = readFileSync(path, "utf8");
        const lines = text.split(/\r?\n/u);
        for (const candidate of fileCandidates) {
          const needle = `\"id\":\"${candidate.id}\"`;
          const line = lines.find((row) => row.includes(needle));
          if (!line || line.trim() !== primaryRows.get(candidate.id)) {
            if (!divergentByFile.has(relativePath)) divergentByFile.set(relativePath, []);
            divergentByFile.get(relativePath).push(candidate);
          }
        }
      }
      if (!divergentByFile.size) continue;
      const divergent = [...divergentByFile.values()].flat();
      diffTasks.push({ worktree, divergent });
    } catch (error) {
      failures.push({
        worktree: worktree.path,
        error: String(error?.message || error).split(/\r?\n/u)[0],
      });
    }
  }
  const diffResults = await mapBatches(diffTasks, AUDIT_DIFF_CONCURRENCY, async ({ worktree, divergent }) => {
    try {
      const diff = await gitTextAtAsync(worktree.path, [
        "diff",
        "--merge-base",
        primary.head,
        "--",
        "data/timeline",
      ]);
      return { claims: claimsFromTimelineDiff(divergent, diff, worktree.path), failure: null };
    } catch (error) {
      return {
        claims: [],
        failure: {
          worktree: worktree.path,
          error: String(error?.message || error).split(/\r?\n/u)[0],
        },
      };
    }
  });
  for (const result of diffResults) {
    claims.push(...result.claims);
    if (result.failure) failures.push(result.failure);
  }
  const mergeBaseDiffScanCount = diffTasks.length;

  let picked = pickUnclaimedCandidates(risk.candidates, claims, limit);
  let acquiredClaim = null;
  if (claim) {
    while (picked.selected.length) {
      const candidate = picked.selected[0];
      const attempt = createAuditClaim(claimRoot, {
        id: candidate.id,
        worktree: currentRoot,
      });
      if (attempt.owned) {
        acquiredClaim = attempt.claim;
        picked = { ...picked, selected: [candidate] };
        break;
      }
      claims.push(attempt.claim);
      picked = pickUnclaimedCandidates(risk.candidates, claims, 1);
    }
  }
  process.stdout.write(JSON.stringify({
    reviewOnly: true,
    primaryHead: primary.head,
    pendingTimelineCount: risk.pendingTimelineCount,
    flaggedCount: risk.flaggedCount,
    scannedCandidateCount: risk.candidates.length,
    discoveredWorktreeCount: possibleScanTargets.length,
    scannedWorktreeCount: scanTargets.length,
    skippedCleanAncestorWorktreeCount,
    ancestorTimelineStatusCheckCount,
    mergeBaseDiffScanCount,
    worktreeScanFailureCount: failures.length,
    candidates: picked.selected.map(compactRiskCandidate),
    claimed: picked.claimed,
    explicitClaimCount: explicit.claims.length,
    staleClaimCountRemoved: explicit.staleRemoved.length,
    acquiredClaim,
    failures,
  }, null, 2) + "\n");
}

async function auditRelease(id) {
  if (!id) throw new Error("audit-release requires <id>");
  const primary = primaryWorktreeInfo();
  if (!primary.path) throw new Error("audit-release could not resolve the primary worktree");
  const currentRoot = gitText(["rev-parse", "--show-toplevel"]);
  const result = releaseAuditClaim(resolve(primary.path, ".work", "audit-claims"), id, currentRoot);
  process.stdout.write(JSON.stringify({ id, ...result }, null, 2) + "\n");
}

async function auditClaim(ids) {
  const requested = [...new Set((ids || []).map((id) => String(id || "").trim()).filter(Boolean))];
  if (!requested.length) throw new Error("audit-claim requires one or more <id> values");
  const primary = primaryWorktreeInfo();
  if (!primary.path || !primary.head) throw new Error("audit-claim could not resolve the primary worktree");
  const currentRoot = gitText(["rev-parse", "--show-toplevel"]);
  if (resolve(currentRoot).toLowerCase() === resolve(primary.path).toLowerCase()) {
    throw new Error("audit-claim requires an isolated linked worktree");
  }
  const primaryRecords = await loadAuditRecords(resolve(primary.path, "data"));
  const timelineIds = new Set(primaryRecords.filter(({ kind }) => kind === "timeline").map(({ id }) => id));
  const missing = requested.filter((id) => !timelineIds.has(id));
  if (missing.length) throw new Error(`unknown primary timeline id(s): ${missing.join(", ")}`);

  const result = createAuditClaims(resolve(primary.path, ".work", "audit-claims"), {
    ids: requested,
    worktree: currentRoot,
  });
  if (!result.owned) {
    throw new Error(
      `audit claim ${result.conflict.id} belongs to ${result.conflict.worktree || result.conflict.label}`,
    );
  }
  process.stdout.write(JSON.stringify({
    worktree: currentRoot,
    claims: result.claims,
  }, null, 2) + "\n");
}

async function auditMark(id, status, noteParts) {
  if (!id || !status) throw new Error("audit-mark requires <id> <status> [note]");
  const currentRoot = gitText(["rev-parse", "--show-toplevel"]);
  const primary = primaryWorktreeInfo();
  const primaryRoot = primary.path || currentRoot;
  const primaryLedgerPath = resolve(primaryRoot, ".work", "audit-ledger.json");
  if (!existsSync(primaryLedgerPath)) {
    throw new Error("primary audit ledger is missing; run audit-init from the primary checkout");
  }
  const primaryDataRoot = resolve(primaryRoot, "data");
  const isPrimary = resolve(currentRoot).toLowerCase() === resolve(primaryRoot).toLowerCase();
  const dataStatus = gitTextAt(primaryRoot, [
    "status",
    "--porcelain",
    "--untracked-files=all",
    "--",
    "data",
  ]).trim();
  if (!isPrimary) {
    if (dataStatus) {
      throw new Error(
        "audit-mark from a linked worktree requires clean primary canonical data; finish or integrate the active primary correction first",
      );
    }
  }
  const primaryRecords = await loadAuditRecords(primaryDataRoot);
  if (!isPrimary) {
    assertAuditRecordMatchesPrimary(await loadAuditRecords(dataRoot), primaryRecords, id);
  }
  const ledger = await readAuditLedger(primaryLedgerPath);
  const commit = gitTextAt(primaryRoot, ["rev-parse", "HEAD"]).trim();
  const mark = {
    id,
    status,
    note: noteParts.join(" "),
  };
  const item = ledger.currentCommit !== commit || dataStatus
    ? syncAndMarkAuditItem(ledger, primaryRecords, { commit, ...mark })
    : markAuditItem(ledger, id, status, mark.note);
  await writeAuditLedger(primaryLedgerPath, ledger);
  if (item.kind === "timeline") {
    releaseAuditClaim(resolve(primaryRoot, ".work", "audit-claims"), id, currentRoot, { force: true });
  }
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
  const nextAction = "Return your final response with the cycle outcome and HARNESS_FEEDBACK. Completed cycles include <!-- GOAL_COMPLETE -->.";
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
} else if (command === "audit-times") {
  await auditTimes();
} else if (command === "audit-time-provenance") {
  await auditTimeProvenance();
} else if (command === "audit-chronology") {
  await auditChronology();
} else if (command === "audit-humanitarian") {
  await auditHumanitarian();
} else if (command === "audit-references") {
  await auditReferences();
} else if (command === "audit-show") {
  await auditShow(process.argv[3]);
} else if (command === "audit-cluster") {
  await auditCluster(process.argv[3], process.argv[4], process.argv[5]);
} else if (command === "audit-captured") {
  await auditCaptured(process.argv[3]);
} else if (command === "audit-prepare") {
  await auditPrepare(process.argv[3], process.argv[4], process.argv[5]);
} else if (command === "audit-diagnose") {
  await auditDiagnose(process.argv[3], process.argv[4], process.argv[5]);
} else if (command === "audit-recover") {
  await auditRecover(process.argv[3], process.argv[4], process.argv[5], process.argv[6]);
} else if (command === "audit-resume") {
  await auditResume(process.argv[3]);
} else if (command === "audit-init") {
  await auditInit(process.argv[3] || "HEAD", process.argv[4] || defaultAuditLedgerPath);
} else if (command === "audit-status") {
  await auditStatus(process.argv[3] || defaultAuditLedgerPath);
} else if (command === "audit-next") {
  await auditNext(process.argv[3] || "25", process.argv[4] || defaultAuditLedgerPath);
} else if (command === "audit-risk") {
  await auditRisk(process.argv[3] || "25", process.argv[4] || defaultAuditLedgerPath);
} else if (command === "audit-pick") {
  const args = process.argv.slice(3);
  const positional = args.filter((arg) => arg !== "--claim");
  await auditPick(positional[0] || "10", positional[1] || "60", { claim: args.includes("--claim") });
} else if (command === "audit-triage") {
  run(process.execPath, [join("research", "automation", "audit-triage.mjs"), ...process.argv.slice(3)]);
} else if (command === "audit-claim") {
  await auditClaim(process.argv.slice(3));
} else if (command === "audit-release") {
  await auditRelease(process.argv[3]);
} else if (command === "audit-mark") {
  await auditMark(process.argv[3], process.argv[4], process.argv.slice(5));
} else if (command === "audit-sync") {
  await auditSync(process.argv[3] || "HEAD", process.argv[4] || defaultAuditLedgerPath);
} else if (command === "finish") {
  await finish(process.argv[3], process.argv.slice(4));
} else if (["help", "--help", "-h", "audit-help"].includes(command)) {
  process.stdout.write([
    "node research/cli.mjs [context]          # show the compact cycle context",
    "node research/cli.mjs ingest <file> [--no-localize] # add/reuse article evidence; skip unrelated localization sync for isolated audits",
    "node research/cli.mjs sync-news-localization # strip stale localized titles outside the newest visible domestic window",
    "node research/cli.mjs capture <id> [--force] # capture or retry one stored article",
    "node research/cli.mjs probe-source <url> [preview-chars] # host/operator network diagnostic; AGY terminal sandbox can block it",
    "node research/cli.mjs archive-verify <id>    # verify the South-local backup copy by checksum",
    "node research/cli.mjs archive-restore <id> [destination] # restore one backup to a review directory",
    "node research/cli.mjs reconstruct <id> [git-ref] # show one historical canonical record with its private capture metadata",
    "node research/cli.mjs audit-times         # inventory exact/date-only times and stored-evidence time support for source review",
    "node research/cli.mjs audit-time-provenance # flag exact times that mirror article publication time without textual support",
    "node research/cli.mjs audit-chronology    # flag retrospective evidence whose publication date may have been copied to an event",
    "node research/cli.mjs audit-humanitarian  # triage single-source humanitarian events with dense numeric summary mismatches",
    "node research/cli.mjs audit-references    # report canonical evidence references and current source URLs outside the registry",
    "node research/cli.mjs audit-show <id>     # show one canonical record with resolved article/timeline evidence",
    "node research/cli.mjs audit-cluster <id> [window-days] [limit] # rank nearby timeline rows that may duplicate or conflate the event",
    "node research/cli.mjs audit-captured <id> # show archived publisher text for cited evidence with prompt-safe caps",
    "node research/cli.mjs audit-prepare <id> [window-days] [limit] [--retry-missing] [--force-capture] # one compact cluster/capture packet; retry only uncaptured transient/missing sources unless forced",
    "node research/cli.mjs audit-diagnose <id> [window-days] [limit] # concise evidence health, exact-time support, and already-known replacement leads",
    "node research/cli.mjs audit-recover <id> [window-days] [limit] [max-attempts] [--force-capture] # retry uncaptured cited evidence first, then ranked replacement leads, stopping after the first usable archive capture",
    "node research/cli.mjs audit-resume <id>   # recover the latest reviewer/verifier state and detect stale evidence after an interrupted audit",
    "node research/cli.mjs audit-init [git-ref] # create the local full-record audit ledger",
    "node research/cli.mjs audit-next [limit]    # show the next prioritized pending records",
    "node research/cli.mjs audit-risk [limit]    # rank pending timeline records by deterministic review-risk signals",
    "node research/cli.mjs audit-pick [limit] [scan-limit] [--claim] # rank high-risk rows; --claim atomically reserves one row from a linked worktree",
    "node research/cli.mjs audit-triage [limit] [scan-limit] [attempts] [concurrency] # safely pick unclaimed risk rows, batch evidence recovery, and return compact next actions",
    "node research/cli.mjs audit-claim <id> [id...] # atomically reserve related timeline rows for the current linked worktree",
    "node research/cli.mjs audit-release <id> # release a reservation when abandoning audit work",
    "node research/cli.mjs audit-mark <id> <reviewed|corrected|merged|unresolved> [note] # sync stale canonical state, then record one audit result",
    "node research/cli.mjs audit-sync [git-ref]  # reopen changed/new records after upstream movement",
    "node research/cli.mjs audit-status          # summarize full-record audit progress",
    "node research/cli.mjs audit-help            # show historical audit commands",
    "node research/cli.mjs finish             # request completion; keep current cadence",
    "node research/cli.mjs finish <hours> <reason>  # complete cycle and change cadence",
    "node research/cli.mjs finish --review <reason> # stop for operator review without publication",
  ].filter((line) => {
    const auditCommand = line.startsWith("node research/cli.mjs audit-");
    const evidenceCommand = /audit-(?:captured|help)\b/u.test(line);
    return command === "audit-help" || !auditCommand || evidenceCommand;
  }).join("\n") + "\n");
} else {
    console.error("Usage: node research/cli.mjs [brief|context|ingest|sync-news-localization|capture|probe-source|archive-verify|archive-restore|reconstruct|audit-times|audit-time-provenance|audit-chronology|audit-humanitarian|audit-references|audit-show|audit-cluster|audit-captured|audit-prepare|audit-diagnose|audit-recover|audit-resume|audit-init|audit-next|audit-risk|audit-pick|audit-triage|audit-claim|audit-release|audit-mark|audit-sync|audit-status|finish]");
  process.exit(2);
}
