import { normalizeArticleUrl } from "./articles.mjs";

function walk(value, path, visit) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => walk(child, `${path}[${index}]`, visit));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    visit(key, child, childPath);
    walk(child, childPath, visit);
  }
}

export function auditReferenceCoverage({ articles = [], timeline = [], current = {} } = {}) {
  const articleIds = new Set(articles.map(({ id }) => id).filter(Boolean));
  const timelineIds = new Set(timeline.map(({ id }) => id).filter(Boolean));
  const articleUrls = new Set(
    articles.map(({ sourceUrl }) => normalizeArticleUrl(sourceUrl)).filter(Boolean),
  );

  const missingTimelineEvidenceIds = [];
  for (const event of timeline) {
    for (const id of event.evidenceIds || []) {
      if (!articleIds.has(id)) missingTimelineEvidenceIds.push({ eventId: event.id, evidenceId: id });
    }
  }

  const missingCurrentEvidenceIds = [];
  const currentSourceUrls = [];
  const missingCurrentSourceUrls = [];
  for (const [name, value] of Object.entries(current)) {
    walk(value, `current/${name}`, (key, child, path) => {
      if (key === "evidenceIds" && Array.isArray(child)) {
        for (const id of child) {
          if (!articleIds.has(id) && !timelineIds.has(id)) {
            missingCurrentEvidenceIds.push({ record: name, path, evidenceId: id });
          }
        }
      }
      if (key === "sourceUrl" && typeof child === "string") {
        const normalizedUrl = normalizeArticleUrl(child);
        const entry = { record: name, path, sourceUrl: child, normalizedUrl };
        currentSourceUrls.push(entry);
        if (!normalizedUrl || !articleUrls.has(normalizedUrl)) missingCurrentSourceUrls.push(entry);
      }
    });
  }

  return {
    articleCount: articles.length,
    timelineEventCount: timeline.length,
    currentRecordCount: Object.keys(current).length,
    missingTimelineEvidenceIds,
    missingCurrentEvidenceIds,
    currentSourceUrls,
    missingCurrentSourceUrls,
    ok: missingTimelineEvidenceIds.length === 0
      && missingCurrentEvidenceIds.length === 0
      && missingCurrentSourceUrls.length === 0,
  };
}
