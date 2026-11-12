import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { newsEnvironmentKey, selectVisibleNews } from "./lib/news.mjs";
import { listFiles, readJson, readJsonl, writeJson } from "./lib/files.mjs";
import { militaryAssessmentFor } from "./lib/military-assessment.mjs";

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
        injuries: impact.injuries,
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
    `Impact: displaced ${compactMetric(output.current.impact.displaced)}; deaths ${compactMetric(output.current.impact.deaths)}; injuries ${compactMetric(output.current.impact.injuries)}`,
    `Thailand ${output.current.thailand.militaryTier || "unrated"}/${militaryAssessmentFor(output.current.thailand.militaryTier)?.score ?? "—"}: ${output.current.thailand.activityLabel || "unlabelled"}.`,
    `Cambodia ${output.current.cambodia.militaryTier || "unrated"}/${militaryAssessmentFor(output.current.cambodia.militaryTier)?.score ?? "—"}: ${output.current.cambodia.activityLabel || "unlabelled"}.`,
    `Summary: ${output.current.summary.summary || ""}`,
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
    "Finish when the record is in the best state the evidence supports: `pnpm research finish`. Pass a new interval and reason only when the next-run cadence should change.",
    "",
  );
  return lines.join("\n");
}

async function finish(hoursText, reasonParts) {
  const statePath = join(dataRoot, "research-state.json");
  const state = await readJson(statePath);
  const cycleRuntimePath = resolve(".work", "CYCLE_RUN.json");
  let cycleId = "";
  if (existsSync(cycleRuntimePath)) {
    const cycleRuntime = await readJson(cycleRuntimePath);
    cycleId = String(cycleRuntime.runId || "").trim();
  }
  const finishMarkerPath = resolve(".work", "research-finish.json");
  if (cycleId && existsSync(finishMarkerPath)) {
    const marker = await readJson(finishMarkerPath);
    if (marker.cycleId === cycleId) {
      if (
        Number(state.lastResearchAt) !== Number(marker.completedAt)
        || Number(state.researchCycleCount) !== Number(marker.researchCycleCount)
      ) {
        throw new Error("finish marker does not match current research state");
      }
      process.stdout.write(JSON.stringify({
        completedAt: new Date(marker.completedAt).toISOString(),
        nextRunAt: new Date(marker.nextRunAt).toISOString(),
        intervalHours: marker.intervalHours,
        researchCycleCount: marker.researchCycleCount,
        alreadyFinished: true,
      }) + "\n");
      return;
    }
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
  const reason = suppliedReason || String(state.schedulingReason || "Research cycle completed.").trim();
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
  if (cycleId) {
    await writeJson(finishMarkerPath, {
      cycleId,
      completedAt,
      nextRunAt,
      intervalHours: hours,
      researchCycleCount: next.researchCycleCount,
    });
  }
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
  const tests = readdirSync(resolve("tests"))
    .filter((name) => name.endsWith(".test.mjs"))
    .sort()
    .map((name) => join("tests", name));
  run(process.execPath, ["--test", ...tests]);
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
} else if (command === "finish") {
  await finish(process.argv[3], process.argv.slice(4));
} else if (command === "help" || command === "--help" || command === "-h") {
  process.stdout.write([
    "pnpm research [context]          # show the compact cycle context",
    "pnpm research finish             # complete cycle; keep current cadence",
    "pnpm research finish <hours> <reason>  # complete cycle and change cadence",
  ].join("\n") + "\n");
} else {
  console.error("Usage: pnpm research [brief|context|finish <hours> <reason>]");
  process.exit(2);
}
