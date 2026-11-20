const DAY_MS = 24 * 60 * 60 * 1000;

const STOP_WORDS = new Set([
  "about", "after", "again", "against", "along", "also", "among", "around", "because", "before",
  "border", "cambodia", "cambodian", "during", "from", "have", "into", "near", "over", "said",
  "says", "than", "that", "their", "there", "these", "they", "this", "thailand", "thai", "through",
  "under", "were", "while", "with", "would",
]);

function dateMs(value) {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function tokens(value) {
  return new Set(
    String(value || "")
      .toLowerCase()
      .normalize("NFKC")
      .replace(/['’]s\b/gu, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .split(/\s+/u)
      .filter((token) => token.length >= 4 && !STOP_WORDS.has(token)),
  );
}

function intersection(left, right) {
  return [...left].filter((value) => right.has(value));
}

function compactArticle(article) {
  if (!article) return null;
  return {
    id: article.id,
    source: article.source,
    publishedAt: article.publishedAt,
    title: article.titleEn || article.title || "",
    summary: article.summary || "",
  };
}

export function buildAuditCluster({ id, timeline = [], articles = [], windowDays = 3, limit = 8 } = {}) {
  if (!id) throw new Error("audit cluster requires a timeline id");
  const target = timeline.find((event) => event.id === id);
  if (!target) throw new Error(`unknown timeline id: ${id}`);
  if (!target.date || !Number.isFinite(dateMs(target.date))) throw new Error(`timeline record has no valid date: ${id}`);

  const articleById = new Map(articles.map((article) => [article.id, article]));
  const targetTitleTokens = tokens(target.title);
  const targetBodyTokens = tokens(`${target.title || ""} ${target.description || ""}`);
  const targetEvidence = new Set(target.evidenceIds || []);
  const targetDateMs = dateMs(target.date);
  const maxDistance = Math.max(0, Math.min(30, Number(windowDays) || 3));

  const candidates = timeline
    .filter((event) => event.id !== id && event.date && Number.isFinite(dateMs(event.date)))
    .map((event) => {
      const distanceDays = Math.round(Math.abs(dateMs(event.date) - targetDateMs) / DAY_MS);
      if (distanceDays > maxDistance) return null;

      const sharedEvidenceIds = (event.evidenceIds || []).filter((evidenceId) => targetEvidence.has(evidenceId));
      const sharedTitleTokens = intersection(targetTitleTokens, tokens(event.title));
      const sharedBodyTokens = intersection(targetBodyTokens, tokens(`${event.title || ""} ${event.description || ""}`));
      const sameDate = event.date === target.date;
      const sameCategory = Boolean(target.category && event.category === target.category);

      if (!sharedEvidenceIds.length && sharedTitleTokens.length < 2 && sharedBodyTokens.length < 5) return null;

      const score = sharedEvidenceIds.length * 12
        + Math.min(sharedTitleTokens.length, 5) * 3
        + Math.min(sharedBodyTokens.length, 8)
        + (sameDate ? 4 : 0)
        + (sameCategory ? 2 : 0)
        - distanceDays;
      const reasons = [];
      if (sharedEvidenceIds.length) reasons.push(`${sharedEvidenceIds.length} shared evidence id(s)`);
      if (sharedTitleTokens.length) reasons.push(`${sharedTitleTokens.length} shared title token(s)`);
      if (sharedBodyTokens.length) reasons.push(`${sharedBodyTokens.length} shared description token(s)`);
      if (sameDate) reasons.push("same event date");
      if (sameCategory) reasons.push("same category");

      return {
        id: event.id,
        date: event.date,
        timeOfDay: event.timeOfDay || "",
        category: event.category || "",
        importance: Number(event.importance || 0),
        title: event.title || "",
        score,
        distanceDays,
        reasons,
        sharedEvidenceIds,
        sharedTitleTokens,
        sharedBodyTokens: sharedBodyTokens.slice(0, 12),
        evidence: (event.evidenceIds || []).map((evidenceId) => compactArticle(articleById.get(evidenceId))).filter(Boolean),
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.distanceDays - right.distanceDays || right.importance - left.importance || left.id.localeCompare(right.id))
    .slice(0, Math.max(1, Math.min(50, Number(limit) || 8)));

  return {
    reviewOnly: true,
    target: {
      id: target.id,
      date: target.date,
      timeOfDay: target.timeOfDay || "",
      category: target.category || "",
      importance: Number(target.importance || 0),
      title: target.title || "",
      description: target.description || "",
      evidence: (target.evidenceIds || []).map((evidenceId) => compactArticle(articleById.get(evidenceId))).filter(Boolean),
    },
    windowDays: maxDistance,
    candidateCount: candidates.length,
    candidates,
  };
}
