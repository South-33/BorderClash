import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { selectVisibleNews } from "./lib/news.mjs";
import { isCanonicalDataPath } from "./lib/data-paths.mjs";
import { getLocalizedTextIssue } from "./lib/localization.mjs";
import { listFiles, readJson, readJsonl } from "./lib/files.mjs";
import { MILITARY_RUBRIC_VERSION, militaryAssessmentFor } from "./lib/military-assessment.mjs";
import { EVIDENCE_ALLOWED_SCORES, EVIDENCE_RUBRIC_VERSION } from "./lib/evidence-score.mjs";

const dataRoot = resolve("data");
const state = await readJson(join(dataRoot, "research-state.json"));
const evidenceRubricActivatedAt = Number(state.evidenceRubricActivatedAt || 0);
const errors = [];
const nativeDigits = /[\u0E50-\u0E59\u17E0-\u17E9\u17F0-\u17F9]/u;
const thaiTimelineChatVoice = /(ครับ|ค่ะ|เพื่อนบอกต่อ|ไทยเรา|บ้านเรา|ของเรา|ฝั่งเรา|กองทัพเรา|ทหารเรา|พวกเขมร)/u;
const khmerTimelinePartisanVoice = /(យើង|ពួកសៀម)/u;
const validationNow = Date.now();
const futureToleranceMs = 5 * 60_000;

function numericTokens(value) {
  const normalized = String(value || "")
    .replace(/(?<=\d)[,.](?=\d{3}(?:\D|$))/gu, "");
  const counts = new Map();
  for (const raw of normalized.match(/\d+/gu) || []) {
    const token = String(Number.parseInt(raw, 10));
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return counts;
}

function numericFidelity(location, english, localizedValue) {
  const expected = numericTokens(english);
  const actual = numericTokens(localizedValue);
  for (const [token, count] of expected) {
    if ((actual.get(token) || 0) < count) {
      add(location, "lost-number-" + token);
    }
  }
}

function add(location, issue) {
  errors.push(location + ": " + issue);
}

function localized(location, value, language, required = false) {
  if (value === undefined || value === null || value === "") {
    if (required) add(location, "missing");
    return;
  }
  const issue = getLocalizedTextIssue(value, language);
  if (issue) add(location, issue);
  if (nativeDigits.test(value)) add(location, "native-digit");
}

function timelineReaderVoice(location, value, language) {
  if (typeof value !== "string") return;
  if (language === "th" && thaiTimelineChatVoice.test(value)) add(location, "conversational-or-partisan-voice");
  if (language === "kh" && khmerTimelinePartisanVoice.test(value)) add(location, "conversational-or-partisan-voice");
}

function httpUrl(location, value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) add(location, "non-http-url");
  } catch {
    add(location, "invalid-url");
  }
}

function directSourceUrl(location, value) {
  httpUrl(location, value);
  if (typeof value === "string" && /(?:vertexaisearch\.cloud\.google\.com|google\.com\/(?:grounding-api-redirect|search\?))/iu.test(value)) {
    add(location, "indirect-source-url");
  }
}

function notFuture(location, value) {
  if (value === undefined || value === null) return;
  if (!Number.isFinite(value)) {
    add(location, "not finite");
    return;
  }
  if (value > validationNow + futureToleranceMs) add(location, "future-timestamp");
}

for (const file of await listFiles(dataRoot)) {
  const path = relative(dataRoot, file).replaceAll("\\", "/");
  if (!isCanonicalDataPath(path)) {
    add(path, "unexpected canonical-data path");
  }
}

const timelineFiles = await listFiles(join(dataRoot, "timeline"), ".jsonl");
const timelineIds = new Set();
for (const file of timelineFiles) {
  const expectedMonth = basename(file, extname(file));
  for (const event of await readJsonl(file)) {
    const location = file + ":" + event.id;
    if (!event.id) add(location, "missing id");
    if (timelineIds.has(event.id)) add(location, "duplicate id " + event.id);
    timelineIds.add(event.id);
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(event.date || "")) add(location, "invalid date");
    if (String(event.date || "").slice(0, 7) !== expectedMonth) add(location, "wrong timeline month");
    notFuture(location + ".createdAt", event.createdAt);
    notFuture(location + ".lastUpdatedAt", event.lastUpdatedAt);
    localized(location + ".titleTh", event.titleTh, "th", true);
    localized(location + ".titleKh", event.titleKh, "kh", true);
    localized(location + ".descriptionTh", event.descriptionTh, "th", true);
    localized(location + ".descriptionKh", event.descriptionKh, "kh", true);
    numericFidelity(location + ".titleTh", event.title, event.titleTh);
    numericFidelity(location + ".titleKh", event.title, event.titleKh);
    numericFidelity(location + ".descriptionTh", event.description, event.descriptionTh);
    numericFidelity(location + ".descriptionKh", event.description, event.descriptionKh);
    timelineReaderVoice(location + ".titleTh", event.titleTh, "th");
    timelineReaderVoice(location + ".titleKh", event.titleKh, "kh");
    timelineReaderVoice(location + ".descriptionTh", event.descriptionTh, "th");
    timelineReaderVoice(location + ".descriptionKh", event.descriptionKh, "kh");
    for (const field of ["impactRescoreProcessed", "impactRescoreProcessedAt", "impactRescoreRunId"]) {
      if (event[field] !== undefined) add(location + "." + field, "legacy timeline field");
    }
    if (!Array.isArray(event.sources) || event.sources.length === 0) add(location, "missing sources");
    const sourceUrls = new Set();
    for (const [index, source] of (event.sources || []).entries()) {
      directSourceUrl(location + ".sources[" + index + "]", source.url);
      notFuture(location + ".sources[" + index + "].addedAt", source.addedAt);
      if (!Number.isFinite(source.credibility) || source.credibility < 0 || source.credibility > 100) {
        add(location + ".sources[" + index + "].credibility", "must be a 0..100 record-level evidence score");
      }
      if (Number.isFinite(source.addedAt) && source.addedAt >= evidenceRubricActivatedAt && !EVIDENCE_ALLOWED_SCORES.has(source.credibility)) {
        add(location + ".sources[" + index + "].credibility", "new evidence must use 30, 55, 75, or 90");
      }
      const normalizedUrl = String(source.url || "").replace(/\/$/u, "");
      if (normalizedUrl && sourceUrls.has(normalizedUrl)) add(location, "duplicate source URL");
      if (normalizedUrl) sourceUrls.add(normalizedUrl);
    }
  }
}

const newsFiles = await listFiles(join(dataRoot, "news"), ".jsonl");
const newsIds = new Set();
const newsStatuses = new Set(["active", "archived", "unverified"]);
const newsByCountry = { thailand: [], cambodia: [], international: [] };
const newsLocations = new Map();
for (const file of newsFiles) {
  const expectedMonth = basename(dirname(file));
  const country = file.endsWith("thailand.jsonl")
    ? "thailand"
    : file.endsWith("cambodia.jsonl")
      ? "cambodia"
      : "international";
  for (const article of await readJsonl(file)) {
    const location = file + ":" + article.id;
    newsByCountry[country].push(article);
    newsLocations.set(article.id, location);
    if (!article.id) add(location, "missing id");
    if (newsIds.has(article.id)) add(location, "duplicate id");
    newsIds.add(article.id);
    if (!(article.titleEn || article.title)) add(location, "missing title");
    if (typeof article.titleEn === "string" && article.titleEn.trim() === String(article.title || "").trim()) {
      add(location + ".titleEn", "duplicate of source title");
    }
    if (!article.source) add(location, "missing source");
    if (!newsStatuses.has(article.status)) add(location, "invalid status");
    if (!Number.isFinite(article.credibility) || article.credibility < 0 || article.credibility > 100) {
      add(location + ".credibility", "must be a 0..100 record-level evidence score");
    }
    if (Number.isFinite(article.fetchedAt) && article.fetchedAt >= evidenceRubricActivatedAt && !EVIDENCE_ALLOWED_SCORES.has(article.credibility)) {
      add(location + ".credibility", "new evidence must use 30, 55, 75, or 90");
    }
    const articleTime = article.publishedAt || article.fetchedAt;
    if (!Number.isFinite(articleTime)) {
      add(location, "missing timestamp");
    } else if (new Date(articleTime).toISOString().slice(0, 7) !== expectedMonth) {
      add(location, "wrong news month");
    }
    directSourceUrl(location + ".sourceUrl", article.sourceUrl);
    notFuture(location + ".fetchedAt", article.fetchedAt);
    notFuture(location + ".sourceVerifiedAt", article.sourceVerifiedAt);
    localized(location + ".titleTh", article.titleTh, "th");
    localized(location + ".titleKh", article.titleKh, "kh");
    for (const field of [
      "summaryEn", "summaryTh", "summaryKh",
      "processedToTimeline", "lastReviewedAt", "hasConflict", "nextReviewAt", "conflictsWith",
    ]) {
      if (article[field] !== undefined) add(location + "." + field, "legacy news field");
    }
  }
}

const visibleNewsIds = new Set([
  ...selectVisibleNews(newsByCountry.cambodia).map((article) => article.id),
  ...selectVisibleNews(newsByCountry.thailand).map((article) => article.id),
]);
for (const [country, articles] of Object.entries(newsByCountry)) {
  for (const article of articles) {
    const location = newsLocations.get(article.id) || country + ":" + article.id;
    if (visibleNewsIds.has(article.id)) {
      localized(location + ".titleTh", article.titleTh, "th", true);
      localized(location + ".titleKh", article.titleKh, "kh", true);
      numericFidelity(location + ".titleTh", article.titleEn || article.title, article.titleTh);
      numericFidelity(location + ".titleKh", article.titleEn || article.title, article.titleKh);
    } else if (article.titleTh !== undefined || article.titleKh !== undefined) {
      add(location, "non-visible news must not keep localized titles");
    }
  }
}

for (const name of ["thailand", "cambodia"]) {
  const value = await readJson(join(dataRoot, "current", name + ".json"));
  const location = "current/" + name;
  notFuture(location + ".updatedAt", value.updatedAt);
  if (!value.summary) add(location + ".summary", "missing");
  if (!Array.isArray(value.sourceNames)) add(location + ".sourceNames", "missing");
  if (value.tensionScore !== undefined) add(location + ".tensionScore", "legacy field");
  if (value.posture !== undefined) add(location + ".posture", "legacy field");
  if (!value.activityLabel) add(location + ".activityLabel", "missing");
  if (!value.activityDetails) add(location + ".activityDetails", "missing");
  const assessment = value.militaryAssessment;
  if (!assessment || typeof assessment !== "object") {
    add(location + ".militaryAssessment", "missing");
  } else {
    if (assessment.rubricVersion !== MILITARY_RUBRIC_VERSION) {
      add(location + ".militaryAssessment.rubricVersion", "unsupported rubric");
    }
    if (!militaryAssessmentFor(assessment.tier)) {
      add(location + ".militaryAssessment.tier", "invalid tier");
    }
    notFuture(location + ".militaryAssessment.assessedAt", assessment.assessedAt);
    if (!Number.isFinite(assessment.assessedAt)) {
      add(location + ".militaryAssessment.assessedAt", "missing");
    }
    if (!Array.isArray(assessment.evidenceIds) || assessment.evidenceIds.length === 0) {
      add(location + ".militaryAssessment.evidenceIds", "must cite at least one stored evidence record");
    } else {
      for (const [index, id] of assessment.evidenceIds.entries()) {
        if (!timelineIds.has(id) && !newsIds.has(id)) {
          add(location + `.militaryAssessment.evidenceIds[${index}]`, "unknown evidence id");
        }
      }
    }
    if (typeof assessment.basis !== "string" || !assessment.basis.trim()) {
      add(location + ".militaryAssessment.basis", "missing");
    }
    for (const forbidden of ["score", "posture", "riskLevel"]) {
      if (assessment[forbidden] !== undefined) {
        add(location + ".militaryAssessment." + forbidden, "derived field must not be stored");
      }
    }
  }
  localized(location + ".summaryTh", value.summaryTh, "th", true);
  localized(location + ".summaryKh", value.summaryKh, "kh", true);
  localized(location + ".activityLabelTh", value.activityLabelTh, "th", true);
  localized(location + ".activityLabelKh", value.activityLabelKh, "kh", true);
  localized(location + ".activityDetailsTh", value.activityDetailsTh, "th", true);
  localized(location + ".activityDetailsKh", value.activityDetailsKh, "kh", true);
  numericFidelity(location + ".summaryTh", value.summary, value.summaryTh);
  numericFidelity(location + ".summaryKh", value.summary, value.summaryKh);
  numericFidelity(location + ".activityLabelTh", value.activityLabel, value.activityLabelTh);
  numericFidelity(location + ".activityLabelKh", value.activityLabel, value.activityLabelKh);
  numericFidelity(location + ".activityDetailsTh", value.activityDetails, value.activityDetailsTh);
  numericFidelity(location + ".activityDetailsKh", value.activityDetails, value.activityDetailsKh);
  for (const field of [
    "officialNarrative",
    "narrativeSource",
    "militaryIntensity",
    "militaryPosture",
    "postureLabel",
    "postureLabelTh",
    "postureLabelKh",
    "postureReason",
    "postureReasonTh",
    "postureReasonKh",
    "postureRationale",
    "territorialContext",
    "lastUpdatedAt",
  ]) {
    if (value[field] !== undefined) add(location + "." + field, "legacy field");
  }
}

const summary = await readJson(join(dataRoot, "current", "summary.json"));
notFuture("current/summary.updatedAt", summary.updatedAt);
if (!summary.summary) add("current/summary.summary", "missing");
if (!Array.isArray(summary.keyUpdates)) add("current/summary.keyUpdates", "missing");
localized("current/summary.summaryTh", summary.summaryTh, "th", true);
localized("current/summary.summaryKh", summary.summaryKh, "kh", true);
numericFidelity("current/summary.summaryTh", summary.summary, summary.summaryTh);
numericFidelity("current/summary.summaryKh", summary.summary, summary.summaryKh);
for (const [index, item] of (summary.keyUpdatesTh || []).entries()) localized("current/summary.keyUpdatesTh[" + index + "]", item, "th", true);
for (const [index, item] of (summary.keyUpdatesKh || []).entries()) localized("current/summary.keyUpdatesKh[" + index + "]", item, "kh", true);
for (const [index, item] of (summary.keyUpdatesTh || []).entries()) numericFidelity("current/summary.keyUpdatesTh[" + index + "]", summary.keyUpdates?.[index], item);
for (const [index, item] of (summary.keyUpdatesKh || []).entries()) numericFidelity("current/summary.keyUpdatesKh[" + index + "]", summary.keyUpdates?.[index], item);
for (const field of ["generalSummary", "keyEvents", "conflictLevel", "displacedCount", "casualtyCount", "lastUpdatedAt"]) {
  if (summary[field] !== undefined) add("current/summary." + field, "legacy field");
}

const impact = await readJson(join(dataRoot, "current", "impact.json"));
notFuture("current/impact.updatedAt", impact.updatedAt);
if (impact.riskLevel !== undefined) add("current/impact.riskLevel", "legacy field");
for (const field of ["displaced", "deaths", "injuries"]) {
  const metric = impact[field];
  if (!metric || typeof metric !== "object") {
    add("current/impact." + field, "missing metric");
    continue;
  }
  if (!["MORE_THAN", "AT_LEAST", "NO_COMBINED_TOTAL"].includes(metric.qualifier)) {
    add("current/impact." + field + ".qualifier", "invalid");
  }
  if (metric.qualifier === "NO_COMBINED_TOTAL") {
    if (metric.value !== null) add("current/impact." + field + ".value", "must be null");
  } else if (!Number.isFinite(metric.value) || metric.value < 0) {
    add("current/impact." + field + ".value", "must be a non-negative number");
  }
  if (metric.claimantName !== undefined) {
    localized("current/impact." + field + ".claimantNameTh", metric.claimantNameTh, "th", true);
    localized("current/impact." + field + ".claimantNameKh", metric.claimantNameKh, "kh", true);
  } else if (metric.claimantNameTh !== undefined || metric.claimantNameKh !== undefined) {
    add("current/impact." + field + ".claimantName", "missing while localized claimant exists");
  }
  if (metric.sourceUrl !== undefined) directSourceUrl("current/impact." + field + ".sourceUrl", metric.sourceUrl);
  if (metric.sourceDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/u.test(metric.sourceDate)) {
    add("current/impact." + field + ".sourceDate", "invalid date");
  }
}
for (const field of ["id", "key", "conflictLevel", "casualtyCount", "displacedTrend", "lastUpdatedAt", "displacedCount", "deathCount", "civilianInjuredCount", "militaryInjuredCount"]) {
  if (impact[field] !== undefined) add("current/impact." + field, "legacy field");
}

notFuture("research-state.lastResearchAt", state.lastResearchAt);
if (state.evidenceRubricVersion !== EVIDENCE_RUBRIC_VERSION) add("research-state.evidenceRubricVersion", "unsupported rubric");
if (!Number.isFinite(state.evidenceRubricActivatedAt)) add("research-state.evidenceRubricActivatedAt", "missing");
notFuture("research-state.evidenceRubricActivatedAt", state.evidenceRubricActivatedAt);
if (state.nextRunAt !== undefined && !Number.isFinite(state.nextRunAt)) add("research-state.nextRunAt", "not finite");
if (state.lastCycleInterval !== undefined && (state.lastCycleInterval < 1 || state.lastCycleInterval > 168)) {
  add("research-state.lastCycleInterval", "outside 1..168 hours");
}
if (Number.isFinite(state.lastResearchAt) && Number.isFinite(state.nextRunAt)) {
  const intervalHours = (state.nextRunAt - state.lastResearchAt) / 3_600_000;
  if (intervalHours < 1 || intervalHours > 168) {
    add("research-state.nextRunAt", "must be 1..168 hours after lastResearchAt");
  }
}

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errorCount: errors.length, errors: errors.slice(0, 100) }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  timelineEvents: timelineIds.size,
  newsArticles: newsIds.size,
}, null, 2));

