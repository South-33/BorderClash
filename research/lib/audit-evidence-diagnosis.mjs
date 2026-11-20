import { buildAuditCapturedEvidence } from "./audit-captured-evidence.mjs";
import { capturedTimeMatches } from "./audit-review-precheck.mjs";

const DAY_MS = 24 * 60 * 60 * 1000;
const STOP_WORDS = new Set([
  "about", "after", "again", "against", "along", "also", "among", "around", "before", "border",
  "cambodia", "cambodian", "during", "from", "have", "into", "near", "over", "said", "says",
  "than", "that", "their", "there", "these", "they", "this", "thailand", "thai", "through",
  "under", "were", "while", "with", "would",
]);

function eventDateMs(value) {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function tokens(value) {
  return new Set(
    String(value || "")
      .toLowerCase()
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .split(/\s+/u)
      .filter((token) => token.length >= 4 && !STOP_WORDS.has(token)),
  );
}

function shared(left, right) {
  return [...left].filter((value) => right.has(value));
}

function isoDate(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? new Date(number).toISOString() : null;
}

function compactCapture(article, capture) {
  return {
    id: article.id,
    source: article.source || "",
    sourceUrl: article.sourceUrl || "",
    publishedIso: isoDate(article.publishedAt),
    title: article.titleEn || article.title || "",
    captureFound: Boolean(capture?.captureFound),
    captureStatus: capture?.latestStatus || "",
    captureQuality: capture?.qualityStatus || "",
  };
}

function rankArticleLeads(target, articles, excludedIds, windowDays, limit) {
  const targetDate = eventDateMs(target.date);
  const titleTokens = tokens(target.title);
  const bodyTokens = tokens(`${target.title || ""} ${target.description || ""}`);
  if (!Number.isFinite(targetDate)) return [];

  return articles
    .filter((article) => article?.id && !excludedIds.has(article.id) && Number(article.publishedAt || 0) > 0)
    .map((article) => {
      const distanceDays = Math.round(Math.abs(Number(article.publishedAt) - targetDate) / DAY_MS);
      if (distanceDays > windowDays) return null;
      const articleTitleTokens = tokens(article.titleEn || article.title);
      const articleBodyTokens = tokens(`${article.titleEn || article.title || ""} ${article.summary || ""}`);
      const sharedTitleTokens = shared(titleTokens, articleTitleTokens);
      const sharedBodyTokens = shared(bodyTokens, articleBodyTokens);
      const strongLead = sharedTitleTokens.length >= 2
        || (distanceDays === 0 && sharedBodyTokens.length >= 6);
      if (!strongLead) return null;
      const sameCategory = Boolean(target.category && target.category === article.category);
      const score = Math.min(sharedTitleTokens.length, 6) * 4
        + Math.min(sharedBodyTokens.length, 10)
        + (sameCategory ? 2 : 0)
        - Math.min(distanceDays, 7);
      const reasons = [];
      if (sharedTitleTokens.length) reasons.push(`${sharedTitleTokens.length} shared title token(s)`);
      if (sharedBodyTokens.length) reasons.push(`${sharedBodyTokens.length} shared body token(s)`);
      if (sameCategory) reasons.push("same category");
      if (distanceDays === 0) reasons.push("published on event date");
      else reasons.push(`published ${distanceDays} day(s) from event date`);
      return {
        article,
        score,
        distanceDays,
        reasons,
        sameCategory,
        sharedTitleTokenCount: sharedTitleTokens.length,
        sharedBodyTokenCount: sharedBodyTokens.length,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.distanceDays - right.distanceDays || left.article.id.localeCompare(right.article.id))
    .slice(0, limit);
}

function searchQueries(target) {
  const keywords = [...tokens(target.title)].slice(0, 5);
  const compactKeywords = keywords.join(" ");
  return [
    `"${target.title}" ${target.date}`,
    compactKeywords ? `${compactKeywords} ${target.date}` : `${target.date} ${target.category || "border"}`,
  ];
}

export async function buildAuditEvidenceDiagnosis({
  id,
  timeline = [],
  articles = [],
  archiveRoot,
  windowDays = 7,
  limit = 8,
} = {}) {
  if (!id) throw new Error("audit evidence diagnosis requires a timeline id");
  const target = timeline.find((event) => event.id === id);
  if (!target) throw new Error(`unknown timeline id: ${id}`);

  const articleById = new Map(articles.map((article) => [article.id, article]));
  const citedArticles = (target.evidenceIds || []).map((articleId) => articleById.get(articleId)).filter(Boolean);
  const citedPacket = { id, kind: "timeline", record: target, evidence: { articles: citedArticles } };
  const citedCaptured = await buildAuditCapturedEvidence(citedPacket, {
    archiveRoot,
    perArticleChars: 4_000,
    totalChars: 24_000,
  });
  const citedCaptureById = new Map(citedCaptured.captures.map((capture) => [capture.articleId, capture]));
  const exactTimeMatches = target.timeOfDay
    ? capturedTimeMatches(target.timeOfDay, citedCaptured.captures)
    : [];

  const maxWindow = Math.max(1, Math.min(30, Number(windowDays) || 7));
  const maxLeads = Math.max(1, Math.min(20, Number(limit) || 8));
  const rankedLeads = rankArticleLeads(target, articles, new Set(target.evidenceIds || []), maxWindow, maxLeads);
  const leadArticles = rankedLeads.map(({ article }) => article);
  const leadPacket = { id, kind: "timeline", record: target, evidence: { articles: leadArticles } };
  const leadCaptured = await buildAuditCapturedEvidence(leadPacket, {
    archiveRoot,
    perArticleChars: 1_000,
    totalChars: 12_000,
  });
  const leadCaptureById = new Map(leadCaptured.captures.map((capture) => [capture.articleId, capture]));
  const usableLeadCount = leadCaptured.captures.filter((capture) => capture.captureFound).length;
  const citedCount = citedArticles.length;
  const capturedCount = citedCaptured.capturedCount;
  const exactTimeSupported = !target.timeOfDay || exactTimeMatches.length > 0;

  let evidenceState = "ready";
  if (!citedCount) evidenceState = "no-evidence";
  else if (capturedCount === 0) evidenceState = "replacement-needed";
  else if (capturedCount < citedCount) evidenceState = "partial";
  else if (!exactTimeSupported) evidenceState = "time-unsupported";

  let nextAction = "review-captured-evidence";
  if (capturedCount === 0 && usableLeadCount > 0) nextAction = "review-existing-leads";
  else if (capturedCount === 0) nextAction = "research-replacement-source";
  else if (!exactTimeSupported) nextAction = "verify-or-remove-exact-time";
  else if (capturedCount < citedCount) nextAction = "review-partial-evidence";

  return {
    reviewOnly: true,
    target: {
      id: target.id,
      date: target.date || "",
      timeOfDay: target.timeOfDay || "",
      category: target.category || "",
      title: target.title || "",
    },
    evidenceState,
    nextAction,
    citedEvidence: citedArticles.map((article) => compactCapture(article, citedCaptureById.get(article.id))),
    exactTime: target.timeOfDay ? {
      value: target.timeOfDay,
      supported: exactTimeSupported,
      matchedArticleIds: exactTimeMatches,
    } : null,
    existingArticleLeads: rankedLeads.map(({
      article,
      score,
      distanceDays,
      reasons,
      sameCategory,
      sharedTitleTokenCount,
      sharedBodyTokenCount,
    }) => ({
      ...compactCapture(article, leadCaptureById.get(article.id)),
      score,
      distanceDays,
      reasons,
      sameCategory,
      sharedTitleTokenCount,
      sharedBodyTokenCount,
    })),
    searchQueries: searchQueries(target),
  };
}
