const PROJECT_TIMEZONE_OFFSET_MS = 7 * 60 * 60 * 1000;

function localDateTime(value) {
  if (!Number.isFinite(value) || value <= 0) return null;
  const shifted = new Date(value + PROJECT_TIMEZONE_OFFSET_MS);
  return {
    date: shifted.toISOString().slice(0, 10),
    time: shifted.toISOString().slice(11, 16),
  };
}

function evidenceText(article) {
  return [article?.titleEn, article?.title, article?.summary].filter(Boolean).join(" ");
}

export function evidenceStatesExactTime(article, timeOfDay) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(String(timeOfDay || ""))) return false;
  const [hour, minute] = timeOfDay.split(":").map(Number);
  const hour12 = hour % 12 || 12;
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  const ampm = hour < 12 ? "a\\.?m\\.?" : "p\\.?m\\.?";
  const patterns = [
    `${hh}[:.]${mm}`,
    `${hour}[:.]${mm}`,
    `${hour12}[:.]${mm}\\s*${ampm}`,
  ];
  if (minute === 0) patterns.push(`\\b${hour12}\\s*${ampm}\\b`);
  if (timeOfDay === "12:00") patterns.push("\\bnoon\\b");
  if (timeOfDay === "00:00") patterns.push("\\bmidnight\\b");
  return new RegExp(patterns.join("|"), "iu").test(evidenceText(article));
}

function evidenceDescriptor(article) {
  return {
    evidenceId: article.id,
    evidenceSource: article.source || "",
    evidenceSourceUrl: article.sourceUrl || "",
    evidenceTitle: article.titleEn || article.title || "",
  };
}

export function auditTimelineTimeSupport(events = [], articles = [], { limit = 25 } = {}) {
  const articlesById = new Map(articles.map((article) => [article.id, article]));
  const candidates = [];
  const missingEvidence = [];
  let exactTimeEventCount = 0;
  let supportedByStoredTextCount = 0;

  for (const event of events) {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(String(event?.timeOfDay || ""))) continue;
    exactTimeEventCount += 1;
    const evidenceIds = event.evidenceIds || [];
    const missingIds = evidenceIds.filter((id) => !articlesById.has(id));
    if (missingIds.length) missingEvidence.push({ eventId: event.id, evidenceIds: missingIds });

    const evidence = evidenceIds.map((id) => articlesById.get(id)).filter(Boolean);
    if (evidence.some((article) => evidenceStatesExactTime(article, event.timeOfDay))) {
      supportedByStoredTextCount += 1;
      continue;
    }

    const evidenceLimit = 8;
    candidates.push({
      eventId: event.id,
      eventDate: event.date,
      eventTime: event.timeOfDay,
      importance: event.importance,
      eventTitle: event.title || "",
      reason: "cited-stored-evidence-text-does-not-state-exact-time",
      evidenceCount: evidence.length,
      evidenceTruncated: evidence.length > evidenceLimit,
      evidence: evidence.slice(0, evidenceLimit).map(evidenceDescriptor),
    });
  }

  const unsupportedTimeDistribution = new Map();
  for (const candidate of candidates) {
    unsupportedTimeDistribution.set(
      candidate.eventTime,
      (unsupportedTimeDistribution.get(candidate.eventTime) || 0) + 1,
    );
  }
  const commonUnsupportedTimes = [...unsupportedTimeDistribution.entries()]
    .map(([timeOfDay, count]) => ({ timeOfDay, count }))
    .sort((a, b) => b.count - a.count || a.timeOfDay.localeCompare(b.timeOfDay))
    .slice(0, 10);

  candidates.sort((a, b) =>
    Number(b.importance || 0) - Number(a.importance || 0)
      || String(a.eventDate).localeCompare(String(b.eventDate))
      || String(a.eventId).localeCompare(String(b.eventId)));

  const candidateLimit = Math.max(1, Math.min(500, Number(limit) || 25));
  return {
    reviewOnly: true,
    exactTimeEventCount,
    supportedByStoredTextCount,
    withoutStoredTextSupportCount: candidates.length,
    missingEvidence,
    commonUnsupportedTimes,
    candidateCount: candidates.length,
    candidateLimit,
    truncated: candidates.length > candidateLimit,
    candidates: candidates.slice(0, candidateLimit),
  };
}

export function auditTimelineTimeProvenance(events = [], articles = []) {
  const articlesById = new Map(articles.map((article) => [article.id, article]));
  const candidates = [];
  const missingEvidence = [];

  for (const event of events) {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(String(event?.timeOfDay || ""))) continue;
    const missingIds = (event.evidenceIds || []).filter((id) => !articlesById.has(id));
    if (missingIds.length) missingEvidence.push({ eventId: event.id, evidenceIds: missingIds });

    const citedEvidence = (event.evidenceIds || []).map((id) => articlesById.get(id)).filter(Boolean);
    if (citedEvidence.some((article) => evidenceStatesExactTime(article, event.timeOfDay))) continue;

    const matches = [];
    for (const article of citedEvidence) {
      const evidenceId = article.id;
      if (!article?.publishedAt) continue;
      const published = localDateTime(article.publishedAt);
      if (!published || published.date !== event.date || published.time !== event.timeOfDay) continue;
      matches.push({
        evidenceId,
        evidencePublishedAt: article.publishedAt,
        evidencePublishedDate: published.date,
        evidencePublishedTime: published.time,
        evidenceSource: article.source || "",
        evidenceSourceUrl: article.sourceUrl || "",
        evidenceTitle: article.titleEn || article.title || "",
      });
    }

    if (!matches.length) continue;
    candidates.push({
      eventId: event.id,
      eventDate: event.date,
      eventTime: event.timeOfDay,
      importance: event.importance,
      eventTitle: event.title || "",
      reason: "event-time-matches-evidence-publication-time-without-textual-time-support",
      matches,
    });
  }

  candidates.sort((a, b) =>
    Number(b.importance || 0) - Number(a.importance || 0)
      || String(a.eventDate).localeCompare(String(b.eventDate))
      || String(a.eventId).localeCompare(String(b.eventId)));

  return {
    timezone: "UTC+07:00",
    eventCount: events.length,
    candidateCount: candidates.length,
    missingEvidence,
    candidates,
  };
}
