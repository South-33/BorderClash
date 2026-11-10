export const VISIBLE_NEWS_STATUSES = new Set(["active", "unverified"]);

const BORDER_RELEVANCE_SIGNAL = /\b(?:border|ceasefire|displac\w*|military|army|troop\w*|mine\w*|landmine\w*|fenc\w*|trench\w*|territor\w*|sovereignt\w*|asean|talks?|tension\w*|closure|crossing\w*|security|attack\w*|conflict\w*|peace\w*|protest\w*|dispute\w*|maritime|unclos|repatriat\w*|citizen\w*|neutral(?:ity)?|general assembly)\b/iu;

export function selectVisibleNews(records, limit = 20) {
  return records
    .filter((row) => VISIBLE_NEWS_STATUSES.has(row.status))
    .sort((a, b) => {
      const published = (b.publishedAt || b.fetchedAt || 0) - (a.publishedAt || a.fetchedAt || 0);
      if (published !== 0) return published;
      return (b.fetchedAt || 0) - (a.fetchedAt || 0);
    })
    .slice(0, limit);
}

export function isBorderRelevantNews(row) {
  return BORDER_RELEVANCE_SIGNAL.test(String(row?.titleEn || row?.title || ""));
}
