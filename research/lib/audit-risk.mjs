import { evidenceStatesExactTime } from "./time-provenance-audit.mjs";

const PROJECT_TIMEZONE_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = new Map([
  ["jan", 1], ["january", 1], ["feb", 2], ["february", 2],
  ["mar", 3], ["march", 3], ["apr", 4], ["april", 4],
  ["may", 5], ["jun", 6], ["june", 6], ["jul", 7], ["july", 7],
  ["aug", 8], ["august", 8], ["sep", 9], ["sept", 9], ["september", 9],
  ["oct", 10], ["october", 10], ["nov", 11], ["november", 11],
  ["dec", 12], ["december", 12],
]);

function projectDate(timestamp) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "";
  return new Date(timestamp + PROJECT_TIMEZONE_OFFSET_MS).toISOString().slice(0, 10);
}

function dateMs(value) {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function evidenceText(article) {
  return [article?.titleEn, article?.title, article?.summary].filter(Boolean).join(" ");
}

function isoDate(year, month, day) {
  const value = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = dateMs(value);
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed).toISOString().slice(0, 10) === value ? value : "";
}

function implicitDate(month, day, reference) {
  const referenceDate = typeof reference === "string" ? reference : "";
  const referenceYear = Number(referenceDate.slice(0, 4) || reference);
  if (!Number.isFinite(referenceYear)) return "";
  if (!referenceDate) return isoDate(referenceYear, month, day);
  const referenceMs = dateMs(referenceDate);
  return [referenceYear - 1, referenceYear, referenceYear + 1]
    .map((year) => isoDate(year, month, day))
    .filter(Boolean)
    .sort((left, right) => Math.abs(dateMs(left) - referenceMs) - Math.abs(dateMs(right) - referenceMs))[0] || "";
}

export function extractStoredEvidenceDates(article, referenceDateOrYear) {
  const text = evidenceText(article);
  const dates = new Set();
  const monthPattern = [...MONTHS.keys()].sort((a, b) => b.length - a.length).join("|");
  const monthFirst = new RegExp(`\\b(${monthPattern})\\.?\\s+([0-3]?\\d)(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b`, "giu");
  const dayFirst = new RegExp(`\\b([0-3]?\\d)(?:st|nd|rd|th)?\\s+(${monthPattern})\\.?(?:\\s+(20\\d{2}))?\\b`, "giu");

  for (const match of text.matchAll(monthFirst)) {
    const month = MONTHS.get(match[1].toLowerCase());
    const value = match[3]
      ? isoDate(Number(match[3]), month, Number(match[2]))
      : implicitDate(month, Number(match[2]), referenceDateOrYear);
    if (value) dates.add(value);
  }
  for (const match of text.matchAll(dayFirst)) {
    const month = MONTHS.get(match[2].toLowerCase());
    const value = match[3]
      ? isoDate(Number(match[3]), month, Number(match[1]))
      : implicitDate(month, Number(match[1]), referenceDateOrYear);
    if (value) dates.add(value);
  }
  return [...dates].sort();
}

function signal(code, weight, detail) {
  return { code, weight, detail };
}

function riskForEvent(event, articlesById, ledgerItem) {
  const evidenceIds = Array.isArray(event.evidenceIds) ? event.evidenceIds : [];
  const evidence = evidenceIds.map((id) => articlesById.get(id)).filter(Boolean);
  const missingEvidenceIds = evidenceIds.filter((id) => !articlesById.has(id));
  const signals = [];

  if (missingEvidenceIds.length) {
    signals.push(signal("missing-evidence", 8, `${missingEvidenceIds.length} cited evidence record(s) are missing`));
  }

  const exactTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(String(event.timeOfDay || ""));
  const exactTimeSupported = exactTime && evidence.some((article) => evidenceStatesExactTime(article, event.timeOfDay));
  if (exactTime && !exactTimeSupported) {
    signals.push(signal("unsupported-exact-time", 3, `${event.timeOfDay} is absent from stored cited title/summary text`));
  }

  if (exactTime && !exactTimeSupported) {
    const publicationCollision = evidence.some((article) => {
      if (!article?.publishedAt) return false;
      const shifted = new Date(article.publishedAt + PROJECT_TIMEZONE_OFFSET_MS).toISOString();
      return shifted.slice(0, 10) === event.date && shifted.slice(11, 16) === event.timeOfDay;
    });
    if (publicationCollision) {
      signals.push(signal("publication-time-collision", 6, "event time matches a cited article publication time"));
    }
  }

  if (evidence.length >= 10) {
    signals.push(signal("many-evidence-records", 3, `${evidence.length} cited articles increase conflation risk`));
  } else if (evidence.length >= 6) {
    signals.push(signal("many-evidence-records", 2, `${evidence.length} cited articles increase conflation risk`));
  }

  const sourceCount = new Set(evidence.map((article) => article.source).filter(Boolean)).size;
  if (sourceCount >= 5) {
    signals.push(signal("many-source-voices", 1, `${sourceCount} distinct cited sources may describe different developments`));
  }

  const publishedDates = [...new Set(evidence.map((article) => projectDate(article.publishedAt)).filter(Boolean))].sort();
  if (publishedDates.length >= 2) {
    const spanDays = Math.round((dateMs(publishedDates.at(-1)) - dateMs(publishedDates[0])) / DAY_MS);
    if (spanDays >= 7) signals.push(signal("wide-publication-span", 3, `cited articles span ${spanDays} publication days`));
    else if (spanDays >= 2) signals.push(signal("wide-publication-span", 2, `cited articles span ${spanDays} publication days`));
  }

  const explicitDates = [...new Set(evidence.flatMap((article) => extractStoredEvidenceDates(article, event.date)))].sort();
  if (explicitDates.length && !explicitDates.includes(event.date)) {
    signals.push(signal("stored-dates-exclude-event-date", 5, `stored cited text mentions ${explicitDates.join(", ")} but not ${event.date}`));
  } else if (explicitDates.length >= 3) {
    signals.push(signal("multi-date-evidence", 1, `stored cited text mentions ${explicitDates.length} distinct dates`));
  }

  const riskScore = signals.reduce((sum, item) => sum + item.weight, 0);
  return {
    id: event.id,
    date: event.date || "",
    timeOfDay: event.timeOfDay || "",
    importance: Number(event.importance || 0),
    title: event.title || "",
    ledgerPriority: Number(ledgerItem?.priority ?? 99),
    ledgerPriorityReason: ledgerItem?.priorityReason || "",
    riskScore,
    evidenceCount: evidence.length,
    sourceCount,
    signals,
  };
}

export function buildAuditRiskQueue({ ledger, timeline = [], articles = [], limit = 25 } = {}) {
  if (!ledger || !Array.isArray(ledger.items)) throw new Error("audit risk queue requires a valid ledger");
  const articlesById = new Map(articles.map((article) => [article.id, article]));
  const timelineById = new Map(timeline.map((event) => [event.id, event]));
  const pendingTimeline = ledger.items.filter((item) => item.present !== false && item.status === "pending" && item.kind === "timeline");
  const candidates = pendingTimeline
    .map((item) => {
      const event = timelineById.get(item.id);
      return event ? riskForEvent(event, articlesById, item) : null;
    })
    .filter((candidate) => candidate && candidate.riskScore > 0)
    .sort((a, b) =>
      b.riskScore - a.riskScore
        || b.importance - a.importance
        || a.ledgerPriority - b.ledgerPriority
        || a.date.localeCompare(b.date)
        || a.id.localeCompare(b.id));

  const candidateLimit = Math.max(1, Math.min(200, Number(limit) || 25));
  return {
    reviewOnly: true,
    pendingTimelineCount: pendingTimeline.length,
    flaggedCount: candidates.length,
    candidateLimit,
    truncated: candidates.length > candidateLimit,
    candidates: candidates.slice(0, candidateLimit),
  };
}
