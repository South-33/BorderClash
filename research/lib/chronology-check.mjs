const RETROSPECTIVE_PATTERNS = [
  /\banniversary\b/iu,
  /\bone year ago\b/iu,
  /\ba year ago\b/iu,
  /\bon this day last year\b/iu,
  /\byear since\b/iu,
  /\blook(?:s|ing)? back\b/iu,
  /\bretrospect(?:ive|ively)?\b/iu,
];

function utcDate(value) {
  if (!Number.isFinite(value)) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function evidenceText(article) {
  return [article?.titleEn, article?.title, article?.summary].filter(Boolean).join(" ");
}

export function checkTimelineChronology(events = [], articles = []) {
  const articlesById = new Map(articles.map((article) => [article.id, article]));
  const candidates = [];
  const missingEvidence = [];

  for (const event of events) {
    const evidence = (event.evidenceIds || []).map((id) => articlesById.get(id)).filter(Boolean);
    const missingIds = (event.evidenceIds || []).filter((id) => !articlesById.has(id));
    if (missingIds.length) missingEvidence.push({ eventId: event.id, evidenceIds: missingIds });

    for (const article of evidence) {
      const publishedDate = utcDate(article.publishedAt || article.fetchedAt);
      if (!publishedDate || !event.date) continue;
      const text = evidenceText(article);
      const retrospectiveSignals = RETROSPECTIVE_PATTERNS
        .filter((pattern) => pattern.test(text))
        .map((pattern) => pattern.source);

      if (publishedDate === event.date && retrospectiveSignals.length) {
        candidates.push({
          eventId: event.id,
          eventDate: event.date,
          evidenceId: article.id,
          evidencePublishedDate: publishedDate,
          reason: "event-date-matches-retrospective-evidence-publication",
          retrospectiveSignals,
          evidenceTitle: article.titleEn || article.title || "",
        });
      }
    }
  }

  return {
    eventCount: events.length,
    candidateCount: candidates.length,
    missingEvidence,
    candidates,
  };
}
