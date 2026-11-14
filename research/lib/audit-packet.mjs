import { normalizeArticleUrl } from "./articles.mjs";

function collectReferences(value, articleIds, timelineIds, missingIds, directSourceUrls, knownArticleIds, knownTimelineIds) {
  if (Array.isArray(value)) {
    for (const child of value) collectReferences(child, articleIds, timelineIds, missingIds, directSourceUrls, knownArticleIds, knownTimelineIds);
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    if ((key === "evidenceIds" || key.endsWith("EvidenceIds")) && Array.isArray(child)) {
      for (const id of child) {
        if (knownArticleIds.has(id)) articleIds.add(id);
        else if (knownTimelineIds.has(id)) timelineIds.add(id);
        else missingIds.add(id);
      }
    }
    if (key === "sourceUrl" && typeof child === "string") directSourceUrls.add(child);
    collectReferences(child, articleIds, timelineIds, missingIds, directSourceUrls, knownArticleIds, knownTimelineIds);
  }
}

function canonicalArticle(record) {
  if (!record) return record;
  const { __file: _file, ...canonical } = record;
  return canonical;
}

export function buildAuditPacket({ id, current = {}, timeline = [], articles = [] } = {}) {
  if (!id) throw new Error("audit packet requires an id");

  const articlesById = new Map(articles.map((record) => [record.id, record]));
  const articlesByUrl = new Map(
    articles
      .map((record) => [normalizeArticleUrl(record.sourceUrl), record])
      .filter(([url]) => Boolean(url)),
  );
  const timelineById = new Map(timeline.map((record) => [record.id, record]));
  const currentName = id.startsWith("current/") ? id.slice("current/".length) : "";

  let kind;
  let record;
  if (currentName && Object.hasOwn(current, currentName)) {
    kind = "current";
    record = current[currentName];
  } else if (timelineById.has(id)) {
    kind = "timeline";
    record = timelineById.get(id);
  } else if (articlesById.has(id)) {
    kind = "news";
    record = articlesById.get(id);
  } else {
    throw new Error(`unknown audit record id: ${id}`);
  }

  const articleIds = new Set();
  const timelineIds = new Set();
  const missingIds = new Set();
  const directSourceUrls = new Set();
  if (kind !== "news") {
    collectReferences(
      record,
      articleIds,
      timelineIds,
      missingIds,
      directSourceUrls,
      new Set(articlesById.keys()),
      new Set(timelineById.keys()),
    );
  }

  // Current records can cite timeline events. Resolve those events to their
  // canonical article evidence as well so an auditor can inspect one packet.
  for (const timelineId of timelineIds) {
    const event = timelineById.get(timelineId);
    if (!event) continue;
    for (const articleId of event.evidenceIds || []) {
      if (articlesById.has(articleId)) articleIds.add(articleId);
      else missingIds.add(articleId);
    }
  }

  const matchedDirectArticles = [];
  const missingDirectSourceUrls = [];
  for (const sourceUrl of directSourceUrls) {
    const article = articlesByUrl.get(normalizeArticleUrl(sourceUrl));
    if (article) {
      matchedDirectArticles.push(article);
      articleIds.add(article.id);
    } else {
      missingDirectSourceUrls.push(sourceUrl);
    }
  }

  return {
    id,
    kind,
    record,
    evidence: {
      timeline: [...timelineIds].map((timelineId) => timelineById.get(timelineId)).filter(Boolean),
      articles: [...articleIds].map((articleId) => canonicalArticle(articlesById.get(articleId))).filter(Boolean),
      missingEvidenceIds: [...missingIds],
      directSourceUrls: [...directSourceUrls],
      matchedDirectArticleIds: matchedDirectArticles.map(({ id: articleId }) => articleId),
      missingDirectSourceUrls,
    },
  };
}
