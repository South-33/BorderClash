import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { assessContentQuality, isBorderRelevantNews, selectVisibleNews } from "../lib/content-quality.mjs";
import { listFiles, readJson, readJsonl, writeJson } from "../lib/files.mjs";

const dataRoot = resolve("data");
const command = process.argv[2] || "brief";
const RESEARCH_TESTS = [
  "tests/data-layout.test.mjs",
  "tests/language.test.mjs",
  "tests/research-content.test.mjs",
  "tests/research-cli.test.mjs",
];
const BRIEF_NEWS_LIMIT = 3;
const BRIEF_TIMELINE_LIMIT = 4;
const BRIEF_FALLBACK_NEWS_LIMIT = 1;
const BRIEF_FALLBACK_TIMELINE_LIMIT = 2;

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
    source: row.source,
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

function briefOverlapHours(state) {
  const interval = Number(state?.lastCycleInterval || 24);
  return Math.min(12, Math.max(1, interval / 2));
}

function selectBriefContext({ state, news, timeline }) {
  const overlapHours = briefOverlapHours(state);
  const overlapMs = overlapHours * 3_600_000;
  const windowStart = Math.max(0, Number(state.lastResearchAt || 0) - overlapMs);
  const eligibleNews = Object.fromEntries(
    Object.entries(news).map(([country, rows]) => [
      country,
      selectVisibleNews(rows, rows.length).filter(isBorderRelevantNews),
    ]),
  );
  const windowNews = Object.fromEntries(
    Object.entries(eligibleNews).map(([country, rows]) => [
      country,
      rows.filter((row) => newsContextTimestamp(row) >= windowStart),
    ]),
  );
  const windowTimeline = timeline.filter((row) => timelineTimestamp(row) >= windowStart);
  const hasWindowNews = Object.values(windowNews).some((rows) => rows.length > 0);
  const hasWindowContext = hasWindowNews || windowTimeline.length > 0;

  const selectedNews = Object.fromEntries(
    Object.entries(hasWindowContext ? windowNews : eligibleNews).map(([country, rows]) => [
      country,
      rows.slice(0, hasWindowContext ? BRIEF_NEWS_LIMIT : BRIEF_FALLBACK_NEWS_LIMIT),
    ]),
  );
  const selectedTimeline = (hasWindowContext ? windowTimeline : timeline)
    .slice(0, hasWindowContext ? BRIEF_TIMELINE_LIMIT : BRIEF_FALLBACK_TIMELINE_LIMIT);

  return {
    mode: hasWindowContext ? "cycle-window" : "fallback-anchors",
    windowStart,
    overlapHours,
    newCounts: {
      timeline: windowTimeline.length,
      news: Object.fromEntries(
        Object.entries(windowNews).map(([country, rows]) => [country, rows.length]),
      ),
    },
    news: selectedNews,
    timeline: selectedTimeline,
  };
}

async function brief() {
  const state = await readJson(join(dataRoot, "state.json"));
  const dashboard = await readJson(join(dataRoot, "dashboard.json"));
  const analyses = Object.fromEntries(
    await Promise.all(
      ["thailand", "cambodia", "neutral"].map(async (name) => [
        name,
        await readJson(join(dataRoot, "analysis", name + ".json")),
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
    const country = file.endsWith("thailand.jsonl")
      ? "thailand"
      : file.endsWith("cambodia.jsonl")
        ? "cambodia"
        : file.endsWith("international.jsonl")
          ? "international"
          : null;
    if (country) news[country].push(...await readJsonl(file));
  }

  for (const values of Object.values(news)) {
    values.sort((a, b) => latestTimestamp(b) - latestTimestamp(a));
  }
  const context = selectBriefContext({ state, news, timeline });

  const contentQuality = assessContentQuality({ news, analyses });
  const compactQuality = contentQuality.score === 100 && contentQuality.issues.length === 0
    ? { score: 100 }
    : {
        score: contentQuality.score,
        unsafeEnglishFallbacks: contentQuality.unsafeEnglishFallbacks,
        missingThai: contentQuality.missingThai,
        missingKhmer: contentQuality.missingKhmer,
        localizedIssues: contentQuality.localizedIssues,
        jargonHits: contentQuality.jargonHits,
        longEnglishSentences: contentQuality.longEnglishSentences,
        relevanceReviewCandidates: contentQuality.relevanceReviewCandidates,
        issues: contentQuality.issues,
      };

  const nowMs = Date.now();
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
      dashboard: {
        conflictLevel: dashboard.conflictLevel,
        displacedCount: dashboard.displacedCount,
        casualtyCount: dashboard.casualtyCount,
        civilianInjuredCount: dashboard.civilianInjuredCount,
        militaryInjuredCount: dashboard.militaryInjuredCount,
        lastUpdatedAt: dashboard.lastUpdatedAt,
      },
      thailand: {
        lastUpdatedAt: analyses.thailand?.lastUpdatedAt,
        militaryIntensity: analyses.thailand?.militaryIntensity,
        militaryPosture: analyses.thailand?.militaryPosture,
        officialNarrative: analyses.thailand?.officialNarrative,
      },
      cambodia: {
        lastUpdatedAt: analyses.cambodia?.lastUpdatedAt,
        militaryIntensity: analyses.cambodia?.militaryIntensity,
        militaryPosture: analyses.cambodia?.militaryPosture,
        officialNarrative: analyses.cambodia?.officialNarrative,
      },
      neutral: {
        lastUpdatedAt: analyses.neutral?.lastUpdatedAt,
        conflictLevel: analyses.neutral?.conflictLevel,
        generalSummary: analyses.neutral?.generalSummary,
        keyEvents: analyses.neutral?.keyEvents,
      },
    },
    contextWindow: {
      mode: context.mode,
      start: toIso(context.windowStart),
      overlapHours: context.overlapHours,
      windowCounts: context.newCounts,
    },
    recentTimeline: context.timeline.map(compactTimeline),
    recentNews: Object.fromEntries(
      Object.entries(context.news).map(([country, values]) => [
        country,
        values.map(compactNews),
      ]),
    ),
    archive: {
      timeline: timeline.length,
      news: Object.values(news).reduce((sum, values) => sum + values.length, 0),
    },
    quality: compactQuality,
  };

  process.stdout.write(JSON.stringify(output) + "\n");
}

async function finish(hoursText, reasonParts) {
  const hours = Number(hoursText);
  const reason = reasonParts.join(" ").trim();
  if (!Number.isFinite(hours) || hours < 1 || hours > 24) {
    throw new Error("finish hours must be between 1 and 24");
  }
  if (reason.length < 8 || reason.length > 240) {
    throw new Error("finish reason must be 8..240 characters");
  }

  const statePath = join(dataRoot, "state.json");
  const state = await readJson(statePath);
  const completedAt = Date.now();
  const nextRunAt = completedAt + Math.round(hours * 3_600_000);

  const next = {
    ...state,
    isPaused: Boolean(state.isPaused),
    systemStatus: "online",
    lastResearchAt: completedAt,
    nextRunAt,
    lastCycleInterval: hours,
    schedulingReason: reason,
    researchCycleCount: Number(state.researchCycleCount || 0) + 1,
    scheduler: "external",
  };
  await writeJson(statePath, next);
  process.stdout.write(JSON.stringify({
    completedAt: new Date(completedAt).toISOString(),
    nextRunAt: new Date(nextRunAt).toISOString(),
    intervalHours: hours,
    researchCycleCount: next.researchCycleCount,
  }) + "\n");
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
  run(process.execPath, ["--test", ...RESEARCH_TESTS]);
  run(process.execPath, [join("scripts", "validate.mjs")]);
  run("git", ["diff", "--check"]);
}

async function records() {
  const rows = [];
  for (const file of await listFiles(join(dataRoot, "news"), ".jsonl")) {
    const country = file.endsWith("thailand.jsonl")
      ? "thailand"
      : file.endsWith("cambodia.jsonl")
        ? "cambodia"
        : "international";
    for (const row of await readJsonl(file)) {
      rows.push({ kind: "news", country, file, row });
    }
  }
  for (const file of await listFiles(join(dataRoot, "timeline"), ".jsonl")) {
    for (const row of await readJsonl(file)) {
      rows.push({ kind: "timeline", file, row });
    }
  }
  return rows;
}

function recordSummary(item) {
  const { row } = item;
  return {
    kind: item.kind,
    country: item.country,
    file: relative(process.cwd(), item.file).replaceAll("\\", "/"),
    id: row.id,
    date: row.date,
    publishedAt: row.publishedAt,
    source: row.source,
    status: row.status,
    title: row.titleEn || row.title,
  };
}

function recordTime(item) {
  const { row } = item;
  if (Number.isFinite(row.publishedAt)) return row.publishedAt;
  if (Number.isFinite(row.fetchedAt)) return row.fetchedAt;
  if (typeof row.date === "string") {
    const time = Date.parse(row.date + "T00:00:00Z");
    if (Number.isFinite(time)) return time;
  }
  return 0;
}

async function find(query) {
  if (!query) throw new Error("Usage: pnpm research find <text>");
  const needle = query.toLocaleLowerCase("en-US");
  const matches = (await records())
    .filter((item) => JSON.stringify(item.row).toLocaleLowerCase("en-US").includes(needle))
    .sort((a, b) => recordTime(b) - recordTime(a))
    .slice(0, 12)
    .map(recordSummary);
  process.stdout.write(JSON.stringify({ query, matches }, null, 2) + "\n");
}

async function show(id) {
  if (!id) throw new Error("Usage: pnpm research show <id>");
  const matches = (await records()).filter((item) => item.row.id === id);
  if (!matches.length) {
    console.error("No record found: " + id);
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(matches.map((item) => ({
    ...recordSummary(item),
    record: item.row,
  })), null, 2) + "\n");
}

if (!existsSync(dataRoot)) {
  throw new Error("Run from the BorderClash research repository root.");
}

if (command === "brief" || command === "context") {
  await brief();
} else if (command === "check") {
  check();
} else if (command === "find") {
  await find(process.argv.slice(3).join(" ").trim());
} else if (command === "show") {
  await show(process.argv[3]);
} else if (command === "finish") {
  await finish(process.argv[3], process.argv.slice(4));
} else if (command === "help") {
  process.stdout.write([
    "node scripts/research.mjs                    # concise cycle brief",
    "node scripts/research.mjs find <text>        # locate relevant archive records",
    "node scripts/research.mjs show <id>           # inspect one exact record",
    "node scripts/research.mjs finish <hours> <reason>  # advance cycle state",
    "node scripts/research.mjs check               # full deterministic exit check",
  ].join("\n") + "\n");
} else {
  console.error("Usage: node scripts/research.mjs [brief|find <text>|show <id>|finish <hours> <reason>|check]");
  process.exit(2);
}
