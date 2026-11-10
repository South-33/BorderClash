import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { isBorderRelevantNews, selectVisibleNews } from "./lib/news.mjs";
import { listFiles, readJson, readJsonl, writeJson } from "./lib/files.mjs";

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
      impact: {
        riskLevel: impact.riskLevel,
        displacedCount: impact.displacedCount,
        deathCount: impact.deathCount,
        civilianInjuredCount: impact.civilianInjuredCount,
        militaryInjuredCount: impact.militaryInjuredCount,
        updatedAt: impact.updatedAt,
      },
      thailand: {
        updatedAt: current.thailand?.updatedAt,
        tensionScore: current.thailand?.tensionScore,
        posture: current.thailand?.posture,
        summary: current.thailand?.summary,
      },
      cambodia: {
        updatedAt: current.cambodia?.updatedAt,
        tensionScore: current.cambodia?.tensionScore,
        posture: current.cambodia?.posture,
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

  return output;
}

function isoDate(value) {
  return Number.isFinite(value) ? new Date(value).toISOString() : "unknown";
}

function renderContext(output) {
  const lines = [
    "# BorderClash cycle context",
    "",
    `Now: ${output.cycle.now}`,
    `Last completed: ${output.cycle.since || "unknown"} (cycle ${output.cycle.count})`,
    `Scheduled next: ${output.cycle.next || "unset"}`,
    `Previous cadence: ${output.cycle.intervalHours || "unknown"}h - ${output.cycle.reason || "no reason recorded"}`,
    "No Git/checks/help, directory lists, or raw archive reads; the runner owns repo checks.",
    "After 3 searches, finish no-change if results predate the last cycle or are already anchored. Source any candidate before changing data.",
    "Finish: pnpm research finish <hours> \"<reason>\". Then stop.",
    "",
    "## Current picture",
    `Overall: ${output.current.impact.riskLevel}; displaced ${output.current.impact.displacedCount}; deaths ${output.current.impact.deathCount}.`,
    `Thailand: ${output.current.thailand.posture || "unknown"} / tension ${output.current.thailand.tensionScore ?? "unknown"}. ${output.current.thailand.summary || ""}`,
    `Cambodia: ${output.current.cambodia.posture || "unknown"} / tension ${output.current.cambodia.tensionScore ?? "unknown"}. ${output.current.cambodia.summary || ""}`,
    `Summary: ${output.current.summary.summary || ""}`,
  ];

  const counts = output.contextWindow.counts;
  const since = output.contextWindow.sinceLastCycleCounts;
  lines.push(
    "",
    "## Research window",
    `${output.contextWindow.lookbackDays} days from ${output.contextWindow.start} to ${output.contextWindow.end}${output.contextWindow.cappedAt30Days ? " (automatic context capped at 30 days)" : ""}.`,
    `In window: timeline ${counts.timeline}; news TH ${counts.news.thailand}, KH ${counts.news.cambodia}, INTL ${counts.news.international}.`,
    `Since last completed cycle: timeline ${since.timeline}; news TH ${since.news.thailand}, KH ${since.news.cambodia}, INTL ${since.news.international}.`,
    "",
    "## Recent timeline anchors",
  );

  for (const row of output.recentTimeline.slice(0, 6)) {
    lines.push(`- ${row.date} ${row.timeOfDay || ""} [${row.id}] ${row.title}`.trim());
  }
  if (!output.recentTimeline.length) lines.push("- none");

  lines.push("", "## Recent evidence anchors");
  for (const [label, key] of [["Thailand", "thailand"], ["Cambodia", "cambodia"], ["International", "international"]]) {
    lines.push(`${label}:`);
    const rows = output.recentNews[key].slice(0, 4);
    if (!rows.length) {
      lines.push("- none");
      continue;
    }
    for (const row of rows) {
      lines.push(`- ${isoDate(row.publishedAt || row.fetchedAt).slice(0, 10)} [${row.id}] ${row.source}: ${row.title}`);
    }
  }

  lines.push(
    "",
    `Archive: ${output.archive.timeline} timeline events; ${output.archive.news} news records. Use \`pnpm research find <text>\` or \`show <id>\` only when deeper local context would improve a decision.`,
    "",
  );
  return lines.join("\n");
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

  const statePath = join(dataRoot, "research-state.json");
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
  run(process.execPath, [join("research", "validate.mjs")]);
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

function htmlAttribute(tag, name) {
  const match = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function decodeHtml(value) {
  if (!value) return null;
  return value
    .replace(/&#(x?[0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code.replace(/^x/i, ""), /^x/i.test(code) ? 16 : 10)))
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/\s+/g, " ")
    .trim();
}

function pageMetadata(html) {
  const meta = new Map();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = htmlAttribute(tag, "property") ?? htmlAttribute(tag, "name") ?? htmlAttribute(tag, "itemprop");
    const content = htmlAttribute(tag, "content");
    if (key && content && !meta.has(key.toLowerCase())) meta.set(key.toLowerCase(), decodeHtml(content));
  }
  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const jsonDate = /"datePublished"\s*:\s*"([^"]+)"/i.exec(html)?.[1] ?? null;
  return {
    title: meta.get("og:title") ?? meta.get("twitter:title") ?? decodeHtml(titleMatch?.[1] ?? null),
    publishedAt: meta.get("article:published_time") ?? meta.get("datepublished") ?? meta.get("pubdate") ?? jsonDate,
    description: meta.get("og:description") ?? meta.get("description") ?? meta.get("twitter:description") ?? null,
  };
}

async function inspectSource(value) {
  if (!value) throw new Error("Usage: pnpm research source <url>");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("source requires a valid HTTP(S) URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("source requires a valid HTTP(S) URL");
  }

  let response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(7_000),
      headers: { "user-agent": "Mozilla/5.0 BorderClashResearch/1.0" },
    });
  } catch (error) {
    process.stdout.write(JSON.stringify({
      url: url.href,
      status: null,
      ok: false,
      usable: false,
      title: null,
      publishedAt: null,
      description: null,
      error: error instanceof Error ? error.message : String(error),
    }, null, 2) + "\n");
    return;
  }
  const contentType = response.headers.get("content-type") ?? "";
  const html = contentType.includes("html") ? await response.text() : "";
  const metadata = html ? pageMetadata(html) : { title: null, publishedAt: null, description: null };
  const usable = response.ok && Boolean(metadata.title || metadata.publishedAt || metadata.description);
  process.stdout.write(JSON.stringify({
    url: response.url || url.href,
    status: response.status,
    ok: response.ok,
    usable,
    ...metadata,
  }, null, 2) + "\n");
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
} else if (command === "find") {
  await find(process.argv.slice(3).join(" ").trim());
} else if (command === "show") {
  await show(process.argv[3]);
} else if (command === "source") {
  await inspectSource(process.argv[3]);
} else if (command === "finish") {
  await finish(process.argv[3], process.argv.slice(4));
} else if (command === "help" || command === "--help" || command === "-h") {
  process.stdout.write([
    "pnpm research                    # concise structured brief",
    "pnpm research context            # compact human-readable cycle context",
    "pnpm research find <text>        # locate relevant archive records",
    "pnpm research show <id>          # inspect one exact record",
    "pnpm research source <url>       # resolve and inspect one publisher source",
    "pnpm research finish <hours> <reason>  # schedule next cycle (1..168h)",
  ].join("\n") + "\n");
} else {
  console.error("Usage: pnpm research [brief|context|find <text>|show <id>|source <url>|finish <hours> <reason>]");
  process.exit(2);
}
