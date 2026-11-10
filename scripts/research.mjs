import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { isBorderRelevantNews, selectVisibleNews } from "../lib/content-quality.mjs";
import { listFiles, readJson, readJsonl, writeJson } from "../lib/files.mjs";

const dataRoot = resolve("data");
const command = process.argv[2] || "brief";
const RESEARCH_TESTS = [
  "tests/data-layout.test.mjs",
  "tests/language.test.mjs",
  "tests/research-content.test.mjs",
  "tests/research-cli.test.mjs",
];
const DAY_MS = 24 * 3_600_000;
const BRIEF_MIN_DAYS = 7;
const BRIEF_MAX_DAYS = 30;
const BRIEF_NEWS_LIMIT = 6;
const BRIEF_TIMELINE_LIMIT = 12;
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
    sourceCount: Array.isArray(row.sources) ? row.sources.length : 0,
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
    Object.entries(news).map(([country, rows]) => [
      country,
      selectVisibleNews(rows, rows.length).filter(isBorderRelevantNews),
    ]),
  );
  const contextNews = Object.fromEntries(
    Object.entries(eligibleNews).map(([country, rows]) => [
      country,
      rows.filter((row) => newsContextTimestamp(row) >= windowStart),
    ]),
  );
  const contextTimeline = timeline.filter((row) => timelineTimestamp(row) >= windowStart);
  const sinceNews = Object.fromEntries(
    Object.entries(eligibleNews).map(([country, rows]) => [
      country,
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
        Object.entries(contextNews).map(([country, rows]) => [country, rows.length]),
      ),
    },
    sinceLastCycleCounts: {
      timeline: sinceTimeline.length,
      news: Object.fromEntries(
        Object.entries(sinceNews).map(([country, rows]) => [country, rows.length]),
      ),
    },
    news: Object.fromEntries(
      Object.entries(contextNews).map(([country, rows]) => [country, rows.slice(0, BRIEF_NEWS_LIMIT)]),
    ),
    timeline: contextTimeline.slice(0, BRIEF_TIMELINE_LIMIT),
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
      start: toIso(context.windowStart),
      end: toIso(nowMs),
      lookbackDays: context.lookbackDays,
      cappedAt30Days: context.cappedAt30Days,
      counts: context.counts,
      sinceLastCycleCounts: context.sinceLastCycleCounts,
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
  };

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}

async function finish(hoursText, reasonParts) {
  const hours = Number(hoursText);
  const reason = reasonParts.join(" ").trim();
  if (!Number.isFinite(hours) || hours < 1 || hours > MAX_SCHEDULE_HOURS) {
    throw new Error(`finish hours must be between 1 and ${MAX_SCHEDULE_HOURS}`);
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
    "node scripts/research.mjs finish <hours> <reason>  # schedule next cycle (1..168h)",
    "node scripts/research.mjs check               # full deterministic exit check",
  ].join("\n") + "\n");
} else {
  console.error("Usage: node scripts/research.mjs [brief|find <text>|show <id>|finish <hours> <reason>|check]");
  process.exit(2);
}
