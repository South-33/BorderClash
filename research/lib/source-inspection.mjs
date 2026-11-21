import { normalizeArticleUrl, publisherArticleIdentity } from "./articles.mjs";

function uniqueArticles(values) {
  const byId = new Map();
  for (const article of values.filter(Boolean)) byId.set(article.id, article);
  return [...byId.values()];
}

function canonicalArticle(article) {
  if (!article) return null;
  const value = { ...article };
  delete value.__file;
  return value;
}

export function matchSourceInspection(url, probe, registry) {
  const identityUrls = [url, probe?.finalUrl, probe?.canonicalUrl]
    .filter(Boolean)
    .map(normalizeArticleUrl)
    .filter(Boolean);

  const directMatches = identityUrls.map((value) => registry.byUrl.get(value)).filter(Boolean);
  const publisherMatches = [];
  for (const value of [url, probe?.finalUrl, probe?.canonicalUrl].filter(Boolean)) {
    const identity = publisherArticleIdentity(value);
    if (!identity) continue;
    publisherMatches.push(...(registry.byPublisherIdentity.get(identity) || []));
  }

  const matches = uniqueArticles([...directMatches, ...publisherMatches]);
  const matchedBy = directMatches.length ? "canonical-url" : publisherMatches.length ? "publisher-identity" : null;
  const outcome = matches.length > 1 ? "needs-review" : matches.length === 1 ? "existing" : "new";

  return {
    outcome,
    readOnly: true,
    sourceUrl: url,
    probe,
    matches: matches.map(canonicalArticle),
    matchedBy,
    remainingJudgment: outcome === "new"
      ? ["whether to retain this source", "category", "mediaEnvironment", "credibility", "status", "canonical title wording"]
      : outcome === "existing"
        ? ["whether this evidence changes the canonical record"]
        : ["which existing canonical article, if any, this URL represents"],
    nextAction: outcome === "existing"
      ? `Inspect the canonical record with: node research/cli.mjs record ${matches[0].id} --captured`
      : outcome === "needs-review"
        ? "Inspect the candidate records before retaining anything. No canonical data was changed."
        : "If this evidence belongs in the record, create a small candidate JSON/JSONL file and run: node research/cli.mjs source add <file>",
  };
}
