import { normalizeArticleUrl } from "./articles.mjs";
import { join } from "node:path";
import { loadArticleRegistry } from "./article-ingest.mjs";
import { listFiles, readJson, readJsonl } from "./files.mjs";

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
  const canonical = { ...record };
  delete canonical.__file;
  return canonical;
}

function compactArticle(record) {
  if (!record) return record;
  return {
    id: record.id,
    source: record.source,
    sourceUrl: record.sourceUrl,
    category: record.category,
    mediaEnvironment: record.mediaEnvironment,
    status: record.status,
    credibility: record.credibility,
    publishedAt: record.publishedAt,
    title: record.titleEn || record.title,
    summary: record.summary,
    provenanceId: record.provenanceId,
  };
}

function compactTimeline(record) {
  if (!record) return record;
  return {
    id: record.id,
    date: record.date,
    timeOfDay: record.timeOfDay,
    category: record.category,
    status: record.status,
    importance: record.importance,
    title: record.title,
    description: record.description,
    evidenceIds: record.evidenceIds,
  };
}

function withoutLocalizedFields(value) {
  if (Array.isArray(value)) return value.map(withoutLocalizedFields);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !/(?:Th|Kh)$/u.test(key))
      .map(([key, child]) => [key, withoutLocalizedFields(child)]),
  );
}

export function compactRecordInspection(packet) {
  if (!packet?.evidence) return packet;
  const record = packet.kind === "timeline"
    ? compactTimeline(packet.record)
    : packet.kind === "news"
      ? compactArticle(packet.record)
      : withoutLocalizedFields(packet.record);
  return {
    ...packet,
    record,
    evidence: {
      ...packet.evidence,
      timeline: (packet.evidence.timeline || []).map(compactTimeline),
      articles: (packet.evidence.articles || []).map(compactArticle),
    },
  };
}

export function buildRecordInspection({
  id,
  current = {},
  timeline = [],
  articles = [],
} = {}) {
  if (!id) throw new Error("record inspection requires an id");

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
    record = canonicalArticle(articlesById.get(id));
  } else {
    throw new Error(`unknown record id: ${id}`);
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
  // canonical article evidence as well so an operator can inspect one packet.
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

  const packet = {
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
  return packet;
}

export async function loadRecordInspection(id, {
  cwd = process.cwd(),
  dataRoot = join(cwd, "data"),
} = {}) {
  const registry = await loadArticleRegistry(dataRoot);
  const timeline = [];
  for (const file of await listFiles(join(dataRoot, "timeline"), ".jsonl")) {
    timeline.push(...await readJsonl(file));
  }
  const current = {};
  for (const name of ["summary", "thailand", "cambodia", "impact"]) {
    current[name] = await readJson(join(dataRoot, "current", `${name}.json`));
  }
  return buildRecordInspection({ id, articles: registry.articles, timeline, current });
}
