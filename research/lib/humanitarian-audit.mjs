const MIN_MEANINGFUL_VALUE = 20;
const MIN_UNREPRESENTED_VALUES = 3;

function normalizeQuantity(value, suffix) {
  let number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (suffix?.toLowerCase() === "k") number *= 1_000;
  return number;
}

function isCalendarYear(value) {
  return Number.isInteger(value) && value >= 1900 && value <= 2100;
}

export function extractMeaningfulNumericClaims(text) {
  const values = new Set();
  const normalized = String(text || "").replaceAll(",", "");
  for (const match of normalized.matchAll(/(?<![\p{L}\p{N}-])(\d+(?:\.\d+)?)\s*([kK])?\b/gu)) {
    const value = normalizeQuantity(match[1], match[2]);
    if (value == null || value < MIN_MEANINGFUL_VALUE || isCalendarYear(value)) continue;
    values.add(value);
  }
  return [...values];
}

function eventText(event) {
  return [event?.title, event?.description].filter(Boolean).join(" ");
}

function articleText(article) {
  return [article?.titleEn, article?.title, article?.summary].filter(Boolean).join(" ");
}

export function auditHumanitarianSummaryRisk(events = [], articles = []) {
  const articlesById = new Map(articles.map((article) => [article.id, article]));
  const candidates = [];
  const missingEvidence = [];

  for (const event of events) {
    if (event?.category !== "humanitarian") continue;
    const evidenceIds = Array.isArray(event.evidenceIds) ? event.evidenceIds : [];
    const evidence = evidenceIds.map((id) => articlesById.get(id)).filter(Boolean);
    const missingIds = evidenceIds.filter((id) => !articlesById.has(id));
    if (missingIds.length) missingEvidence.push({ eventId: event.id, evidenceIds: missingIds });

    // This is deliberately a high-precision triage rule. Multi-source events
    // need source-level review rather than inference from compact summaries.
    if (evidence.length !== 1 || missingIds.length) continue;

    const eventValues = extractMeaningfulNumericClaims(eventText(event));
    const evidenceValues = extractMeaningfulNumericClaims(articleText(evidence[0]));
    const evidenceSet = new Set(evidenceValues);
    const unrepresentedValues = eventValues.filter((value) => !evidenceSet.has(value));
    if (unrepresentedValues.length < MIN_UNREPRESENTED_VALUES) continue;

    candidates.push({
      eventId: event.id,
      eventDate: event.date || "",
      evidenceId: evidence[0].id,
      reason: "single-evidence-humanitarian-event-has-multiple-numbers-absent-from-stored-summary",
      eventValues,
      evidenceSummaryValues: evidenceValues,
      unrepresentedValues,
      eventTitle: event.title || "",
      evidenceTitle: evidence[0].titleEn || evidence[0].title || "",
      reviewNote: "Triage only: open the source or preserved capture before deciding whether any event claim is unsupported or needs correction.",
    });
  }

  return {
    humanitarianEventCount: events.filter((event) => event?.category === "humanitarian").length,
    candidateCount: candidates.length,
    missingEvidence,
    candidates,
  };
}
