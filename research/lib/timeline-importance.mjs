export const TIMELINE_IMPORTANCE_RUBRIC_VERSION = "timeline-importance-v1";

const TIMELINE_IMPORTANCE = Object.freeze({
  CONTEXT: 50,
  NOTABLE: 70,
  MAJOR: 80,
  DEFINING: 95,
});

export const TIMELINE_IMPORTANCE_ALLOWED = new Set(Object.values(TIMELINE_IMPORTANCE));

export function normalizeTimelineImportance(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return TIMELINE_IMPORTANCE.CONTEXT;
  if (score >= 90) return TIMELINE_IMPORTANCE.DEFINING;
  if (score > 75) return TIMELINE_IMPORTANCE.MAJOR;
  if (score >= 70) return TIMELINE_IMPORTANCE.NOTABLE;
  return TIMELINE_IMPORTANCE.CONTEXT;
}
