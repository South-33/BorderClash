import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { isValidProvenanceId, normalizeArticleUrl, publisherArticleIdentity } from "./articles.mjs";
import { captureArticle, fetchEvidence, storeEvidenceAttempt } from "./evidence-archive.mjs";
import { listFiles, readJsonl, writeJsonl } from "./files.mjs";

const execFileAsync = promisify(execFile);

function stableArticleId(identityUrl) {
  return createHash("sha256").update(identityUrl).digest("hex").slice(0, 32);
}

function articleTime(article) {
  return Number(article?.publishedAt || article?.fetchedAt || 0);
}

function monthFor(article) {
  const value = articleTime(article);
  if (!Number.isFinite(value) || value <= 0) throw new Error("article requires publishedAt or fetchedAt");
  return new Date(value).toISOString().slice(0, 7);
}

function hostFor(value) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./u, "");
  } catch {
    return "";
  }
}

function titleTokens(value) {
  return new Set(
    String(value || "")
      .toLowerCase()
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .split(/\s+/u)
      .filter((token) => token.length >= 2),
  );
}

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

export async function loadArticleRegistry(dataRoot) {
  const files = await listFiles(join(dataRoot, "news"), ".jsonl");
  const articles = [];
  for (const file of files) {
    for (const article of await readJsonl(file)) articles.push({ ...article, __file: file });
  }
  const byId = new Map();
  const byUrl = new Map();
  const byPublisherIdentity = new Map();
  const byProvenance = new Map();
  for (const article of articles) {
    byId.set(article.id, article);
    const normalized = normalizeArticleUrl(article.sourceUrl);
    if (normalized) byUrl.set(normalized, article);
    const publisherIdentity = publisherArticleIdentity(article.sourceUrl);
    if (publisherIdentity) {
      const matches = byPublisherIdentity.get(publisherIdentity) || [];
      matches.push(article);
      byPublisherIdentity.set(publisherIdentity, matches);
    }
    if (article.provenanceId) {
      const matches = byProvenance.get(article.provenanceId) || [];
      matches.push(article);
      byProvenance.set(article.provenanceId, matches);
    }
  }
  return { articles, byId, byUrl, byPublisherIdentity, byProvenance };
}

export function findAmbiguousArticles(candidate, articles, identityUrl = candidate.sourceUrl) {
  const targetHost = hostFor(identityUrl);
  const targetTitle = titleTokens(candidate.titleEn || candidate.title);
  const targetTime = articleTime(candidate);
  if (!targetHost || !targetTitle.size || !targetTime) return [];
  return articles
    .filter((article) => hostFor(article.sourceUrl) === targetHost)
    .map((article) => ({
      article,
      titleSimilarity: jaccard(targetTitle, titleTokens(article.titleEn || article.title)),
      timeDistanceMs: Math.abs(articleTime(article) - targetTime),
    }))
    .filter(({ titleSimilarity, timeDistanceMs }) => titleSimilarity >= 0.72 && timeDistanceMs <= 3 * 24 * 3_600_000)
    .sort((a, b) => b.titleSimilarity - a.titleSimilarity)
    .map(({ article, titleSimilarity, timeDistanceMs }) => ({
      id: article.id,
      sourceUrl: article.sourceUrl,
      title: article.titleEn || article.title,
      titleSimilarity: Number(titleSimilarity.toFixed(3)),
      timeDistanceMs,
    }));
}

function validateCandidate(candidate) {
  for (const field of ["sourceUrl", "source", "category", "mediaEnvironment", "status"]) {
    if (!String(candidate?.[field] || "").trim()) throw new Error(`candidate is missing ${field}`);
  }
  if (!String(candidate.titleEn || candidate.title || "").trim()) throw new Error("candidate is missing title");
  if (!Number.isFinite(candidate.credibility)) throw new Error("candidate is missing credibility");
  if (candidate.provenanceId !== undefined && !isValidProvenanceId(candidate.provenanceId)) {
    throw new Error("candidate provenanceId must be a stable lowercase identifier");
  }
  monthFor(candidate);
}

function reconcilePublisherTime(candidate, fetched) {
  const hint = fetched?.publishedAtHint;
  if (!hint || !Number.isFinite(hint.publishedAt)) return { adjustment: null };
  const supplied = Number(candidate.publishedAt || candidate.fetchedAt || 0);
  if (!Number.isFinite(supplied) || supplied <= 0) return { adjustment: null };
  const distanceMs = Math.abs(supplied - hint.publishedAt);
  if (distanceMs > 36 * 3_600_000) {
    return {
      review: {
        action: "review",
        sourceUrl: fetched.canonicalUrl || fetched.finalUrl || candidate.sourceUrl,
        reason: "candidate publication date conflicts with retained publisher metadata",
        candidatePublishedAt: supplied,
        publisherPublishedAtHint: hint,
      },
    };
  }
  if (supplied === hint.publishedAt) return { adjustment: null };
  const adjustment = { from: supplied, to: hint.publishedAt, publisherPublishedAtHint: hint };
  candidate.publishedAt = hint.publishedAt;
  return { adjustment };
}

function identityUrls(candidate, fetched) {
  return [candidate.sourceUrl, fetched?.finalUrl, fetched?.canonicalUrl]
    .filter(Boolean)
    .map(normalizeArticleUrl)
    .filter(Boolean);
}

function publisherIdentityMatches(registry, urls) {
  const matches = new Map();
  for (const url of urls) {
    const identity = publisherArticleIdentity(url);
    if (!identity) continue;
    for (const article of registry.byPublisherIdentity.get(identity) || []) matches.set(article.id, article);
  }
  return [...matches.values()];
}

async function appendArticle(dataRoot, article) {
  const path = join(dataRoot, "news", `${monthFor(article)}.jsonl`);
  let rows = [];
  try {
    rows = await readJsonl(path);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  rows.push(article);
  await writeJsonl(path, rows);
  return path;
}

async function captureSafely(article, options, fetched = null) {
  try {
    return fetched
      ? await storeEvidenceAttempt(article.id, fetched, options)
      : await captureArticle(article, options);
  } catch (error) {
    return { articleId: article.id, status: "capture-error", error: String(error?.message || error) };
  }
}

function currentIdentityConflicts(article, registry, urls = [article.sourceUrl]) {
  const matches = new Map();
  for (const url of urls.filter(Boolean)) {
    const normalized = normalizeArticleUrl(url);
    const byUrl = normalized ? registry.byUrl.get(normalized) : null;
    if (byUrl && byUrl.id !== article.id) matches.set(byUrl.id, byUrl);
  }
  for (const match of publisherIdentityMatches(registry, urls)) {
    if (match.id !== article.id) matches.set(match.id, match);
  }
  return [...matches.values()];
}

export async function ingestCandidates(candidates, options = {}) {
  const dataRoot = options.dataRoot || "data";
  for (const candidate of candidates) validateCandidate(candidate);
  const registry = await loadArticleRegistry(dataRoot);
  const results = [];
  for (const rawCandidate of candidates) {
    const candidate = { ...rawCandidate };
    const inputIdentity = normalizeArticleUrl(candidate.sourceUrl);
    const known = registry.byUrl.get(inputIdentity);
    if (known) {
      const capture = await captureSafely(known, options);
      results.push({ action: "existing", id: known.id, sourceUrl: known.sourceUrl, capture });
      continue;
    }
    const publisherKnown = publisherIdentityMatches(registry, [candidate.sourceUrl]);
    if (publisherKnown.length === 1) {
      const existingArticle = publisherKnown[0];
      const capture = await captureSafely(existingArticle, options);
      results.push({ action: "existing", id: existingArticle.id, sourceUrl: existingArticle.sourceUrl, capture });
      continue;
    }
    if (publisherKnown.length > 1) {
      results.push({
        action: "review",
        sourceUrl: candidate.sourceUrl,
        reason: "publisher identity already maps to multiple stored article IDs",
        ambiguous: publisherKnown.map((article) => ({
          id: article.id,
          sourceUrl: article.sourceUrl,
          title: article.titleEn || article.title,
        })),
      });
      continue;
    }

    const fetched = await fetchEvidence(candidate.sourceUrl, options);
    if (fetched.status === "blocked-destination") {
      results.push({
        action: "review",
        sourceUrl: candidate.sourceUrl,
        reason: fetched.error || "source URL is not a public HTTP(S) destination",
      });
      continue;
    }
    const publication = reconcilePublisherTime(candidate, fetched);
    if (publication.review) {
      results.push(publication.review);
      continue;
    }
    const publicationAdjustment = publication.adjustment;
    const identities = identityUrls(candidate, fetched);
    const existing = identities.map((url) => registry.byUrl.get(url)).find(Boolean);
    if (existing) {
      const capture = await captureSafely(existing, options, fetched);
      results.push({ action: "existing", id: existing.id, sourceUrl: existing.sourceUrl, capture });
      continue;
    }
    const publisherMatches = publisherIdentityMatches(registry, identities);
    if (publisherMatches.length === 1) {
      const existingArticle = publisherMatches[0];
      const capture = await captureSafely(existingArticle, options, fetched);
      results.push({ action: "existing", id: existingArticle.id, sourceUrl: existingArticle.sourceUrl, capture });
      continue;
    }
    if (publisherMatches.length > 1) {
      results.push({
        action: "review",
        sourceUrl: fetched.canonicalUrl || fetched.finalUrl || candidate.sourceUrl,
        reason: "publisher identity already maps to multiple stored article IDs",
        ambiguous: publisherMatches.map((article) => ({
          id: article.id,
          sourceUrl: article.sourceUrl,
          title: article.titleEn || article.title,
        })),
      });
      continue;
    }

    const preferredUrl = fetched.canonicalUrl || fetched.finalUrl || candidate.sourceUrl;
    const ambiguous = findAmbiguousArticles(candidate, registry.articles, preferredUrl);
    if (ambiguous.length) {
      results.push({ action: "review", sourceUrl: preferredUrl, ambiguous });
      continue;
    }

    const identity = normalizeArticleUrl(preferredUrl);
    const id = String(candidate.id || stableArticleId(identity));
    if (registry.byId.has(id)) throw new Error(`article id already exists with another identity: ${id}`);
    const article = {
      ...candidate,
      id,
      sourceUrl: preferredUrl,
      fetchedAt: Number(candidate.fetchedAt || options.now || Date.now()),
    };
    delete article.__file;
    const file = await appendArticle(dataRoot, article);
    article.__file = file;
    registry.articles.push(article);
    registry.byId.set(id, article);
    for (const url of identities.length ? identities : [identity]) registry.byUrl.set(url, article);
    const publisherIdentity = publisherArticleIdentity(article.sourceUrl);
    if (publisherIdentity) registry.byPublisherIdentity.set(publisherIdentity, [article]);
    const sharedProvenanceWith = article.provenanceId
      ? (registry.byProvenance.get(article.provenanceId) || []).map(({ id: existingId }) => existingId)
      : [];
    if (article.provenanceId) {
      const matches = registry.byProvenance.get(article.provenanceId) || [];
      matches.push(article);
      registry.byProvenance.set(article.provenanceId, matches);
    }
    const capture = await captureSafely(article, options, fetched);
    results.push({
      action: "added",
      id,
      sourceUrl: article.sourceUrl,
      file: relative(dataRoot, file).replaceAll("\\", "/"),
      sharedProvenanceWith,
      publicationAdjustment,
      capture,
    });
  }
  return results;
}

export async function captureChangedArticles(baseRef, options = {}) {
  const dataRoot = options.dataRoot || "data";
  const registry = await loadArticleRegistry(dataRoot);
  const results = [];
  const git = async (args) => {
    if (options.gitCommand) return options.gitCommand(args);
    const { stdout } = await execFileAsync("git", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    return stdout;
  };
  const changed = new Set();
  for (const line of String(await git(["diff", "--name-only", baseRef, "--", "data/news"]))
    .split(/\r?\n/u).filter(Boolean)) changed.add(line.replaceAll("\\", "/"));
  for (const line of String(await git(["ls-files", "--others", "--exclude-standard", "--", "data/news"]))
    .split(/\r?\n/u).filter(Boolean)) changed.add(line.replaceAll("\\", "/"));

  for (const file of [...changed].sort()) {
    let currentRows;
    try {
      const relativeNewsPath = file.replace(/^data[\\/]/u, "");
      currentRows = await readJsonl(join(dataRoot, relativeNewsPath));
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    let priorRows = [];
    try {
      const text = await git(["show", `${baseRef}:${file}`]);
      priorRows = String(text)
        .split(/\r?\n/u)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    } catch {
      priorRows = [];
    }
    const priorById = new Map(priorRows.map((row) => [row.id, row]));
    for (const article of currentRows) {
      const prior = priorById.get(article.id);
      if (prior && normalizeArticleUrl(prior.sourceUrl) === normalizeArticleUrl(article.sourceUrl)) continue;

      const staticMatches = currentIdentityConflicts(article, registry);
      if (staticMatches.length) {
        results.push({
          articleId: article.id,
          status: "identity-conflict",
          reason: "manual article matches an existing canonical URL or publisher article identity",
          existingIds: staticMatches.map(({ id }) => id),
        });
        continue;
      }

      let fetched;
      try {
        fetched = await fetchEvidence(article.sourceUrl, options);
      } catch (error) {
        results.push({ articleId: article.id, status: "capture-error", error: String(error?.message || error) });
        continue;
      }
      if (fetched.status === "blocked-destination") {
        results.push({
          articleId: article.id,
          status: "identity-conflict",
          reason: fetched.error || "manual article source is not a public HTTP(S) destination",
          existingIds: [],
        });
        continue;
      }

      const fetchedUrls = identityUrls(article, fetched);
      const fetchedMatches = currentIdentityConflicts(article, registry, fetchedUrls);
      if (fetchedMatches.length) {
        const existing = fetchedMatches[0];
        await captureSafely(existing, options, fetched);
        results.push({
          articleId: article.id,
          status: "identity-conflict",
          reason: "manual article redirect or canonical URL resolves to an existing article",
          existingIds: fetchedMatches.map(({ id }) => id),
        });
        continue;
      }

      const preferredUrl = fetched.canonicalUrl || fetched.finalUrl || article.sourceUrl;
      const ambiguous = findAmbiguousArticles(
        article,
        registry.articles.filter(({ id }) => id !== article.id),
        preferredUrl,
      );
      if (ambiguous.length) {
        results.push({
          articleId: article.id,
          status: "identity-conflict",
          reason: "manual article is similar to an existing same-publisher article",
          existingIds: ambiguous.map(({ id }) => id),
          ambiguous,
        });
        continue;
      }

      results.push(await captureSafely(article, options, fetched));
    }
  }
  return results;
}

export async function readCandidateFile(path) {
  const text = await readFile(path, "utf8");
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) return JSON.parse(trimmed);
  return trimmed.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
}
