export const VISIBLE_NEWS_STATUSES = new Set(["active", "unverified"]);
export const NEWS_MEDIA_ENVIRONMENTS = new Set(["thailand-domestic", "cambodia-domestic", "international"]);
export const PUBLIC_NEWS_LIMIT = 60;
export const LOCALIZED_NEWS_LIMIT = 20;

export function newsEnvironmentKey(value) {
  if (value === "thailand-domestic") return "thailand";
  if (value === "cambodia-domestic") return "cambodia";
  if (value === "international") return "international";
  return null;
}

export function selectVisibleNews(records, limit = PUBLIC_NEWS_LIMIT) {
  return records
    .filter((row) => VISIBLE_NEWS_STATUSES.has(row.status))
    .sort((a, b) => {
      const published = (b.publishedAt || b.fetchedAt || 0) - (a.publishedAt || a.fetchedAt || 0);
      if (published !== 0) return published;
      return (b.fetchedAt || 0) - (a.fetchedAt || 0);
    })
    .slice(0, limit);
}
