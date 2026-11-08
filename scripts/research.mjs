import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { assessContentQuality } from "../lib/content-quality.mjs";
import { listFiles, readJson, readJsonl } from "../lib/files.mjs";

const dataRoot = resolve("data");
const command = process.argv[2] || "context";

function latestTimestamp(row) {
  return row.publishedAt || row.fetchedAt || row.lastUpdatedAt || 0;
}

function compactNews(row) {
  return {
    id: row.id,
    publishedAt: row.publishedAt,
    source: row.source,
    category: row.category,
    title: row.titleEn || row.title,
    sourceUrl: row.sourceUrl,
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

async function context() {
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

  const nowMs = Date.now();
  const toIso = (value) => Number.isFinite(value) ? new Date(value).toISOString() : null;
  const output = {
    clock: {
      nowMs,
      nowIso: new Date(nowMs).toISOString(),
      lastResearchAtIso: toIso(state.lastResearchAt),
      nextRunAtIso: toIso(state.nextRunAt),
    },
    state,
    dashboard,
    analysis: {
      thailand: {
        lastUpdatedAt: analyses.thailand?.lastUpdatedAt,
        militaryIntensity: analyses.thailand?.militaryIntensity,
        militaryPosture: analyses.thailand?.militaryPosture,
        officialNarrative: analyses.thailand?.officialNarrativeEn || analyses.thailand?.officialNarrative,
      },
      cambodia: {
        lastUpdatedAt: analyses.cambodia?.lastUpdatedAt,
        militaryIntensity: analyses.cambodia?.militaryIntensity,
        militaryPosture: analyses.cambodia?.militaryPosture,
        officialNarrative: analyses.cambodia?.officialNarrativeEn || analyses.cambodia?.officialNarrative,
      },
      neutral: {
        lastUpdatedAt: analyses.neutral?.lastUpdatedAt,
        conflictLevel: analyses.neutral?.conflictLevel,
        generalSummary: analyses.neutral?.generalSummaryEn || analyses.neutral?.generalSummary,
        keyEvents: analyses.neutral?.keyEventsEn || analyses.neutral?.keyEvents,
      },
    },
    recentTimeline: timeline.slice(0, 6).map(compactTimeline),
    recentNews: Object.fromEntries(
      Object.entries(news).map(([country, values]) => [
        country,
        values.slice(0, 4).map(compactNews),
      ]),
    ),
    counts: {
      timeline: timeline.length,
      news: Object.fromEntries(Object.entries(news).map(([country, values]) => [country, values.length])),
    },
    contentQuality: assessContentQuality({ news, analyses }),
  };

  process.stdout.write(JSON.stringify(output) + "\n");
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
  const tests = readdirSync(resolve("tests"))
    .filter((name) => name.endsWith(".test.mjs"))
    .sort()
    .map((name) => join("tests", name));
  run(process.execPath, ["--test", ...tests]);
  run(process.execPath, [join("scripts", "validate.mjs")]);
  run(process.execPath, [join("scripts", "generate-public.mjs")]);
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

if (command === "context") {
  await context();
} else if (command === "check") {
  check();
} else if (command === "find") {
  await find(process.argv.slice(3).join(" ").trim());
} else if (command === "show") {
  await show(process.argv[3]);
} else {
  console.error("Usage: node scripts/research.mjs [context|find <text>|show <id>|check]");
  process.exit(2);
}
