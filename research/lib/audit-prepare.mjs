import { buildAuditCapturedEvidence } from "./audit-captured-evidence.mjs";
import { buildAuditCluster } from "./audit-cluster.mjs";

const RETRYABLE_CAPTURE_STATUSES = new Set(["", "transient-failure"]);
const USABLE_CAPTURE_STATUSES = new Set(["captured-html", "captured-document", "captured-text"]);
const DEFAULT_PREVIEW_CHARS = 600;
const DEFAULT_DESCRIPTION_CHARS = 500;

function isoDate(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return null;
  return new Date(number).toISOString();
}

function preview(value, limit = DEFAULT_PREVIEW_CHARS) {
  const normalized = String(value || "")
    .replace(/\r\n?/gu, "\n")
    .replace(/[\t ]+/gu, " ")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
  if (normalized.length <= limit) return normalized;
  return normalized.slice(0, limit).trimEnd() + "…";
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, Number(limit) || 1), items.length) },
    async () => {
      while (index < items.length) {
        const current = index++;
        results[current] = await worker(items[current]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

function compactEvidence(article, capture, previewChars) {
  return {
    id: article.id,
    source: article.source || "",
    publishedIso: isoDate(article.publishedAt),
    credibility: article.credibility,
    provenanceId: article.provenanceId || "",
    title: article.titleEn || article.title || "",
    captureFound: Boolean(capture?.captureFound),
    captureStatus: capture?.latestStatus || "",
    captureQuality: capture?.qualityStatus || "",
    capturePreview: preview(capture?.text, previewChars),
  };
}

function recordRow(event, role, clusterCandidate, articlesById, capturesById, previewChars) {
  const evidence = (event.evidenceIds || [])
    .map((id) => articlesById.get(id))
    .filter(Boolean)
    .map((article) => compactEvidence(article, capturesById.get(article.id), previewChars));
  return {
    role,
    id: event.id,
    date: event.date || "",
    timeOfDay: event.timeOfDay || "",
    category: event.category || "",
    importance: Number(event.importance || 0),
    title: event.title || "",
    descriptionPreview: preview(event.description, DEFAULT_DESCRIPTION_CHARS),
    score: clusterCandidate?.score ?? null,
    reasons: clusterCandidate?.reasons || [],
    sharedEvidenceIds: clusterCandidate?.sharedEvidenceIds || [],
    evidence,
  };
}

export async function buildAuditPreparation({
  id,
  timeline = [],
  articles = [],
  windowDays = 3,
  limit = 8,
  retryMissing = false,
  forceCapture = false,
  captureConcurrency = 3,
  captureArticleFn = null,
  archiveRoot,
  perArticleChars = 2_000,
  totalChars = 80_000,
  previewChars = DEFAULT_PREVIEW_CHARS,
} = {}) {
  if (!id) throw new Error("audit preparation requires a timeline id");
  const cluster = buildAuditCluster({ id, timeline, articles, windowDays, limit });
  const timelineById = new Map(timeline.map((event) => [event.id, event]));
  const articlesById = new Map(articles.map((article) => [article.id, article]));
  const selected = [
    { event: timelineById.get(id), role: "target", clusterCandidate: null },
    ...cluster.candidates.map((candidate) => ({
      event: timelineById.get(candidate.id),
      role: "candidate",
      clusterCandidate: candidate,
    })),
  ].filter(({ event }) => Boolean(event));

  const uniqueArticleIds = [...new Set(
    selected.flatMap(({ event }) => event.evidenceIds || []),
  )];
  const selectedArticles = uniqueArticleIds.map((articleId) => articlesById.get(articleId)).filter(Boolean);
  const capturePacket = {
    id,
    kind: "timeline",
    record: timelineById.get(id),
    evidence: { articles: selectedArticles },
  };

  let captured = await buildAuditCapturedEvidence(capturePacket, {
    archiveRoot,
    perArticleChars,
    totalChars,
  });
  let capturesById = new Map(captured.captures.map((capture) => [capture.articleId, capture]));
  const missingBefore = selectedArticles.filter((article) => !capturesById.get(article.id)?.captureFound);
  const retryEligible = missingBefore.filter((article) => {
    if (forceCapture) return true;
    return RETRYABLE_CAPTURE_STATUSES.has(capturesById.get(article.id)?.latestStatus || "");
  });
  const skippedPersistent = missingBefore.filter((article) => !retryEligible.includes(article));

  let captureAttempts = [];
  if (retryMissing && retryEligible.length && typeof captureArticleFn === "function") {
    captureAttempts = await mapLimit(retryEligible, captureConcurrency, async (article) => {
      try {
        const result = await captureArticleFn(article, { force: true });
        const status = result?.status || "";
        return {
          articleId: article.id,
          usable: USABLE_CAPTURE_STATUSES.has(status),
          status,
          error: "",
        };
      } catch (error) {
        return {
          articleId: article.id,
          usable: false,
          status: "capture-error",
          error: String(error?.message || error),
        };
      }
    });
    captured = await buildAuditCapturedEvidence(capturePacket, {
      archiveRoot,
      perArticleChars,
      totalChars,
    });
    capturesById = new Map(captured.captures.map((capture) => [capture.articleId, capture]));
  }

  const records = selected.map(({ event, role, clusterCandidate }) => (
    recordRow(event, role, clusterCandidate, articlesById, capturesById, previewChars)
  ));
  const captureFoundCount = selectedArticles.filter((article) => capturesById.get(article.id)?.captureFound).length;
  const provenanceCounts = new Map();
  for (const article of selectedArticles) {
    if (!article.provenanceId) continue;
    provenanceCounts.set(article.provenanceId, (provenanceCounts.get(article.provenanceId) || 0) + 1);
  }

  return {
    reviewOnly: true,
    targetId: id,
    windowDays: cluster.windowDays,
    candidateCount: cluster.candidateCount,
    recordCount: records.length,
    captureSummary: {
      articleCount: selectedArticles.length,
      capturedCount: captureFoundCount,
      missingCount: selectedArticles.length - captureFoundCount,
      retryRequested: Boolean(retryMissing),
      retryEligibleCount: retryEligible.length,
      retriedCount: captureAttempts.length,
      skippedPersistentCount: skippedPersistent.length,
    },
    captureAttempts,
    skippedPersistent: skippedPersistent.map((article) => ({
      articleId: article.id,
      source: article.source || "",
      status: capturesById.get(article.id)?.latestStatus || "",
    })),
    sharedProvenance: [...provenanceCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([provenanceId, count]) => ({ provenanceId, count }))
      .sort((left, right) => right.count - left.count || left.provenanceId.localeCompare(right.provenanceId)),
    records,
  };
}
