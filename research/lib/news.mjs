export const VISIBLE_NEWS_STATUSES = new Set(["active", "unverified"]);

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
