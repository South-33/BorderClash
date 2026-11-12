import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { newsEnvironmentKey, PUBLIC_NEWS_LIMIT, selectVisibleNews, VISIBLE_NEWS_STATUSES } from "../research/lib/news.mjs";
import { listFiles, readJson, readJsonl, writeJson, writeJsonArrayOnePerLine } from "../research/lib/files.mjs";
import { militaryAssessmentFor, riskLevelFromTiers } from "../research/lib/military-assessment.mjs";
import { normalizeEvidenceScore } from "../research/lib/evidence-score.mjs";
import { normalizeTimelineImportance } from "../research/lib/timeline-importance.mjs";

const dataRoot = resolve("data");
const publicRoot = resolve("public", "data");
async function readAllNews() {
  const files = (await listFiles(join(dataRoot, "news"), ".jsonl"));
  const records = { thailand: [], cambodia: [], international: [] };

  for (const file of files) {
    for (const article of await readJsonl(file)) {
      const environment = newsEnvironmentKey(article.mediaEnvironment);
      if (environment) records[environment].push(article);
    }
  }
  return records;
}

function visibleNews(records, limit = PUBLIC_NEWS_LIMIT) {
  return selectVisibleNews(records, limit)
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
      credibility: normalizeEvidenceScore(article.credibility, article.status),
      status: article.status,
    }));
}

function articleCounts(news) {
  const count = (environment) => news[environment].filter((row) => VISIBLE_NEWS_STATUSES.has(row.status)).length;
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
    importance: normalizeTimelineImportance(event.importance),
    status: event.status,
    sources: Array.isArray(event.sources)
      ? event.sources.map((source) => ({
        url: source.url,
        name: source.name,
        credibility: normalizeEvidenceScore(source.credibility),
      }))
      : [],
  };
}

function perspectivePublic(value) {
  if (!value) return null;
  const assessment = militaryAssessmentFor(value.militaryAssessment?.tier);
  if (!assessment) throw new Error(`Invalid military assessment tier: ${value.militaryAssessment?.tier || "missing"}`);
  return {
    summary: value.summary,
    summaryTh: value.summaryTh,
    summaryKh: value.summaryKh,
    sourceNames: value.sourceNames,
    tensionScore: assessment.score,
    posture: assessment.posture,
    postureLabel: value.activityLabel,
    postureLabelTh: value.activityLabelTh,
    postureLabelKh: value.activityLabelKh,
    postureReason: value.activityDetails,
    postureReasonTh: value.activityDetailsTh,
    postureReasonKh: value.activityDetailsKh,
    updatedAt: value.updatedAt,
  };
}

function summaryPublic(value) {
  if (!value) return null;
  return {
    summary: value.summary,
    summaryTh: value.summaryTh,
    summaryKh: value.summaryKh,
    keyUpdates: value.keyUpdates,
    keyUpdatesTh: value.keyUpdatesTh,
    keyUpdatesKh: value.keyUpdatesKh,
    updatedAt: value.updatedAt,
  };
}

function metricDisplay(metric) {
  if (!metric || metric.value == null) return "—";
  const number = Number(metric.value).toLocaleString("en-US");
  if (metric.qualifier === "MORE_THAN") return `>${number}`;
  if (metric.qualifier === "AT_LEAST") return `≥${number}`;
  return number;
}

function impactPublic(value, thailand, cambodia, lastResearchAt) {
  if (!value) return null;
  return {
    riskLevel: riskLevelFromTiers(thailand?.militaryAssessment?.tier, cambodia?.militaryAssessment?.tier),
    displacedCount: metricDisplay(value.displaced),
    deathCount: metricDisplay(value.deaths),
    // The unchanged UI labels this field simply "UPDATED". Expose the most
    // recent completed research verification here; canonical impact.json keeps
    // the underlying evidence/source timestamps separately.
    updatedAt: lastResearchAt || value.updatedAt,
  };
}

const [news, thailandPerspective, cambodiaPerspective, currentSummary, impact, researchState] = await Promise.all([
  readAllNews(),
  readJson(join(dataRoot, "current", "thailand.json")),
  readJson(join(dataRoot, "current", "cambodia.json")),
  readJson(join(dataRoot, "current", "summary.json")),
  readJson(join(dataRoot, "current", "impact.json")),
  readJson(join(dataRoot, "research-state.json")),
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

const snapshot = {
  deploymentVersion: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || null,
  thailandNews: visibleNews(news.thailand, PUBLIC_NEWS_LIMIT),
  cambodiaNews: visibleNews(news.cambodia, PUBLIC_NEWS_LIMIT),
  thailandPerspective: perspectivePublic(thailandPerspective),
  cambodiaPerspective: perspectivePublic(cambodiaPerspective),
  summary: summaryPublic(currentSummary),
  impact: impactPublic(impact, thailandPerspective, cambodiaPerspective, researchState.lastResearchAt),
  timelineEvents: [],
  researchState: {
    lastResearchAt: researchState.lastResearchAt,
    status: researchState.systemStatus,
    paused: researchState.isPaused,
    nextRunAt: researchState.nextRunAt,
    intervalHours: researchState.lastCycleInterval,
    reason: researchState.schedulingReason,
  },
  articleCounts: articleCounts(news),
};

const dashboardPath = join(publicRoot, "dashboard.json");
const timelinePath = join(publicRoot, "timeline.json");
await writeJson(dashboardPath, snapshot);
await writeJsonArrayOnePerLine(timelinePath, timeline);
const [dashboardFile, timelineFile] = await Promise.all([stat(dashboardPath), stat(timelinePath)]);

console.log(JSON.stringify({
  dashboardBytes: dashboardFile.size,
  timelineBytes: timelineFile.size,
  timelineEvents: timeline.length,
  articleCounts: snapshot.articleCounts,
}, null, 2));

