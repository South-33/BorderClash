import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { isCanonicalDataPath } from "../lib/data-layout.mjs";
import { getLocalizedTextIssue } from "../lib/language.mjs";
import { listFiles, readJson, readJsonl } from "../lib/files.mjs";

const dataRoot = resolve("data");
const errors = [];
const nativeDigits = /[\u0E50-\u0E59\u17E0-\u17E9\u17F0-\u17F9]/u;
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
  if (typeof value === "string" && /(?:vertexaisearch\.cloud\.google\.com|google\.com\/grounding-api-redirect)/iu.test(value)) {
    add(location, "grounding-redirect");
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
    if (!Array.isArray(event.sources) || event.sources.length === 0) add(location, "missing sources");
    for (const [index, source] of (event.sources || []).entries()) {
      directSourceUrl(location + ".sources[" + index + "]", source.url);
      notFuture(location + ".sources[" + index + "].addedAt", source.addedAt);
    }
  }
}

const newsFiles = await listFiles(join(dataRoot, "news"), ".jsonl");
const newsIds = new Set();
const newsStatuses = new Set(["active", "archived", "false", "outdated", "unverified"]);
for (const file of newsFiles) {
  const expectedMonth = basename(dirname(file));
  for (const article of await readJsonl(file)) {
    const location = file + ":" + article.id;
    if (!article.id) add(location, "missing id");
    if (newsIds.has(article.id)) add(location, "duplicate id");
    newsIds.add(article.id);
    if (!(article.titleEn || article.title)) add(location, "missing title");
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
    localized(location + ".summaryTh", article.summaryTh, "th");
    localized(location + ".summaryKh", article.summaryKh, "kh");
  }
}

for (const [name, kind] of [["thailand", "perspective"], ["cambodia", "perspective"], ["neutral", "neutral"]]) {
  const value = await readJson(join(dataRoot, "analysis", name + ".json"));
  notFuture("analysis/" + name + ".lastUpdatedAt", value.lastUpdatedAt);
  if (kind === "perspective") {
    localized("analysis/" + name + ".officialNarrativeTh", value.officialNarrativeTh, "th", true);
    localized("analysis/" + name + ".officialNarrativeKh", value.officialNarrativeKh, "kh", true);
    localized("analysis/" + name + ".postureLabelTh", value.postureLabelTh, "th", true);
    localized("analysis/" + name + ".postureLabelKh", value.postureLabelKh, "kh", true);
    localized("analysis/" + name + ".postureRationaleTh", value.postureRationaleTh, "th", true);
    localized("analysis/" + name + ".postureRationaleKh", value.postureRationaleKh, "kh", true);
  } else {
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

