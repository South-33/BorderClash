import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { selectVisibleNews } from "../lib/content-quality.mjs";
import { isCanonicalDataPath } from "../lib/data-layout.mjs";
import { getLocalizedTextIssue } from "../lib/language.mjs";
import { listFiles, readJson, readJsonl } from "../lib/files.mjs";

const dataRoot = resolve("data");
const errors = [];
const nativeDigits = /[\u0E50-\u0E59\u17E0-\u17E9\u17F0-\u17F9]/u;
const thaiTimelineChatVoice = /(ครับ|ค่ะ|เพื่อนบอกต่อ|ไทยเรา|บ้านเรา|ของเรา|ฝั่งเรา|กองทัพเรา|ทหารเรา|พวกเขมร)/u;
const khmerTimelinePartisanVoice = /(យើង|ពួកសៀម)/u;
const validationNow = Date.now();
const futureToleranceMs = 5 * 60_000;

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
    } else if (article.titleTh !== undefined || article.titleKh !== undefined) {
      add(location, "non-visible news must not keep localized titles");
    }
  }
}

for (const [name, kind] of [["thailand", "perspective"], ["cambodia", "perspective"], ["neutral", "neutral"]]) {
  const value = await readJson(join(dataRoot, "analysis", name + ".json"));
  notFuture("analysis/" + name + ".lastUpdatedAt", value.lastUpdatedAt);
  if (kind === "perspective") {
    if (!value.officialNarrative) add("analysis/" + name + ".officialNarrative", "missing");
    if (!value.postureLabel) add("analysis/" + name + ".postureLabel", "missing");
    if (!value.postureRationale) add("analysis/" + name + ".postureRationale", "missing");
    for (const field of ["officialNarrativeEn", "postureLabelEn", "postureRationaleEn"]) {
      if (value[field] !== undefined) add("analysis/" + name + "." + field, "legacy English alias");
    }
    localized("analysis/" + name + ".officialNarrativeTh", value.officialNarrativeTh, "th", true);
    localized("analysis/" + name + ".officialNarrativeKh", value.officialNarrativeKh, "kh", true);
    localized("analysis/" + name + ".postureLabelTh", value.postureLabelTh, "th", true);
    localized("analysis/" + name + ".postureLabelKh", value.postureLabelKh, "kh", true);
    localized("analysis/" + name + ".postureRationaleTh", value.postureRationaleTh, "th", true);
    localized("analysis/" + name + ".postureRationaleKh", value.postureRationaleKh, "kh", true);
  } else {
    if (!value.generalSummary) add("analysis/neutral.generalSummary", "missing");
    if (!Array.isArray(value.keyEvents)) add("analysis/neutral.keyEvents", "missing");
    for (const field of ["generalSummaryEn", "keyEventsEn"]) {
      if (value[field] !== undefined) add("analysis/neutral." + field, "legacy English alias");
    }
    localized("analysis/neutral.generalSummaryTh", value.generalSummaryTh, "th", true);
    localized("analysis/neutral.generalSummaryKh", value.generalSummaryKh, "kh", true);
    for (const [index, item] of (value.keyEventsTh || []).entries()) localized("analysis/neutral.keyEventsTh[" + index + "]", item, "th", true);
    for (const [index, item] of (value.keyEventsKh || []).entries()) localized("analysis/neutral.keyEventsKh[" + index + "]", item, "kh", true);
  }
}

const dashboard = await readJson(join(dataRoot, "dashboard.json"));
notFuture("dashboard.lastUpdatedAt", dashboard.lastUpdatedAt);

const state = await readJson(join(dataRoot, "state.json"));
notFuture("state.lastResearchAt", state.lastResearchAt);
if (state.nextRunAt !== undefined && !Number.isFinite(state.nextRunAt)) add("state.nextRunAt", "not finite");
if (state.lastCycleInterval !== undefined && (state.lastCycleInterval < 1 || state.lastCycleInterval > 24)) {
  add("state.lastCycleInterval", "outside 1..24 hours");
}
if (Number.isFinite(state.lastResearchAt) && Number.isFinite(state.nextRunAt)) {
  const intervalHours = (state.nextRunAt - state.lastResearchAt) / 3_600_000;
  if (intervalHours < 1 || intervalHours > 24) {
    add("state.nextRunAt", "must be 1..24 hours after lastResearchAt");
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

