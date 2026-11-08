import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { listFiles, readJson, readJsonl, writeJson, writeJsonArrayOnePerLine } from "../lib/files.mjs";

const dataRoot = resolve("data");
const publicRoot = resolve("public", "data");
const visibleStatuses = new Set(["active", "unverified"]);

async function readAllNews() {
  const files = (await listFiles(join(dataRoot, "news"), ".jsonl"));
  const records = { thailand: [], cambodia: [], international: [] };

  for (const file of files) {
    const country = file.endsWith("thailand.jsonl")
      ? "thailand"
      : file.endsWith("cambodia.jsonl")
        ? "cambodia"
        : file.endsWith("international.jsonl")
          ? "international"
          : null;
    if (!country) continue;
    records[country].push(...await readJsonl(file));
  }
  return records;
}

function visibleNews(records, limit = 20) {
  return records
    .filter((row) => visibleStatuses.has(row.status))
    .sort((a, b) => {
      const published = (b.publishedAt || b.fetchedAt || 0) - (a.publishedAt || a.fetchedAt || 0);
      if (published !== 0) return published;
      return (b.fetchedAt || 0) - (a.fetchedAt || 0);
    })
    .slice(0, limit)
    .map((article) => ({
      _id: article.id,
      title: article.title,
      titleEn: article.titleEn,
      titleTh: article.titleTh,
      titleKh: article.titleKh,
      publishedAt: article.publishedAt,
      fetchedAt: article.fetchedAt,
      source: article.source,
      sourceUrl: article.sourceUrl,
      category: article.category,
      credibility: article.credibility,
      status: article.status,
    }));
}

function articleCounts(news) {
  const count = (country) => news[country].filter((row) => visibleStatuses.has(row.status)).length;
  const thailand = count("thailand");
  const cambodia = count("cambodia");
  const international = count("international");
  return { thailand, cambodia, international, total: thailand + cambodia + international };
}

function timelinePublic(event) {
  return {
    _id: event.id,
    date: event.date,
    timeOfDay: event.timeOfDay,
    title: event.title,
    titleTh: event.titleTh,
    titleKh: event.titleKh,
    description: event.description,
    descriptionTh: event.descriptionTh,
    descriptionKh: event.descriptionKh,
    category: event.category,
    importance: event.importance,
    status: event.status,
    sources: Array.isArray(event.sources)
      ? event.sources.map((source) => ({
        url: source.url,
        name: source.name,
        credibility: source.credibility,
      }))
      : [],
  };
}

function perspectivePublic(value) {
  if (!value) return null;
  return {
    officialNarrative: value.officialNarrative,
    officialNarrativeEn: value.officialNarrativeEn,
    officialNarrativeTh: value.officialNarrativeTh,
    officialNarrativeKh: value.officialNarrativeKh,
    narrativeSource: value.narrativeSource,
    militaryIntensity: value.militaryIntensity,
    militaryPosture: value.militaryPosture,
    postureLabel: value.postureLabel,
    postureLabelTh: value.postureLabelTh,
    postureLabelKh: value.postureLabelKh,
    postureRationale: value.postureRationale,
    postureRationaleTh: value.postureRationaleTh,
    postureRationaleKh: value.postureRationaleKh,
    territorialContext: value.territorialContext,
    lastUpdatedAt: value.lastUpdatedAt,
  };
}

function neutralPublic(value) {
  if (!value) return null;
  return {
    generalSummary: value.generalSummary,
    generalSummaryEn: value.generalSummaryEn,
    generalSummaryTh: value.generalSummaryTh,
    generalSummaryKh: value.generalSummaryKh,
    conflictLevel: value.conflictLevel,
    keyEvents: value.keyEvents,
    keyEventsEn: value.keyEventsEn,
    keyEventsTh: value.keyEventsTh,
    keyEventsKh: value.keyEventsKh,
    displacedCount: value.displacedCount,
    displacedTrend: value.displacedTrend,
    civilianInjuredCount: value.civilianInjuredCount,
    militaryInjuredCount: value.militaryInjuredCount,
    injuredCount: value.injuredCount,
    casualtyCount: value.casualtyCount,
    lastUpdatedAt: value.lastUpdatedAt,
  };
}

function dashboardStatsPublic(value) {
  if (!value) return null;
  return {
    conflictLevel: value.conflictLevel,
    displacedCount: value.displacedCount,
    displacedTrend: value.displacedTrend,
    civilianInjuredCount: value.civilianInjuredCount,
    militaryInjuredCount: value.militaryInjuredCount,
    casualtyCount: value.casualtyCount,
    summary: value.summary,
    lastUpdatedAt: value.lastUpdatedAt,
  };
}

const [news, thailandAnalysis, cambodiaAnalysis, neutralAnalysis, dashboardStats, systemState] = await Promise.all([
  readAllNews(),
  readJson(join(dataRoot, "analysis", "thailand.json")),
  readJson(join(dataRoot, "analysis", "cambodia.json")),
  readJson(join(dataRoot, "analysis", "neutral.json")),
  readJson(join(dataRoot, "dashboard.json")),
  readJson(join(dataRoot, "state.json")),
]);

const timeline = [];
for (const file of await listFiles(join(dataRoot, "timeline"), ".jsonl")) {
  for (const event of await readJsonl(file)) {
    timeline.push(timelinePublic(event));
  }
}
timeline.sort((a, b) => {
  const date = String(b.date || "").localeCompare(String(a.date || ""));
  if (date !== 0) return date;
  return String(b.timeOfDay || "").localeCompare(String(a.timeOfDay || ""));
});

const dashboard = {
  thailandNews: visibleNews(news.thailand),
  cambodiaNews: visibleNews(news.cambodia),
  thailandAnalysis: perspectivePublic(thailandAnalysis),
  cambodiaAnalysis: perspectivePublic(cambodiaAnalysis),
  neutralAnalysis: neutralPublic(neutralAnalysis),
  dashboardStats: dashboardStatsPublic(dashboardStats),
  timelineEvents: [],
  systemStats: {
    lastResearchAt: systemState.lastResearchAt,
    systemStatus: systemState.systemStatus,
    isPaused: systemState.isPaused,
    nextRunAt: systemState.nextRunAt,
    lastCycleInterval: systemState.lastCycleInterval,
    schedulingReason: systemState.schedulingReason,
  },
  articleCounts: articleCounts(news),
};

const dashboardPath = join(publicRoot, "dashboard.json");
const timelinePath = join(publicRoot, "timeline.json");
await writeJson(dashboardPath, dashboard);
await writeJsonArrayOnePerLine(timelinePath, timeline);
const [dashboardFile, timelineFile] = await Promise.all([stat(dashboardPath), stat(timelinePath)]);

console.log(JSON.stringify({
  dashboardBytes: dashboardFile.size,
  timelineBytes: timelineFile.size,
  timelineEvents: timeline.length,
  articleCounts: dashboard.articleCounts,
}, null, 2));

