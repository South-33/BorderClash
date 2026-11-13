export function normalizeArticleUrl(value) {
  return String(value || "").trim().replace(/\/$/u, "");
}

export function articleCountByEnvironment(articles) {
  const counts = { thailand: 0, cambodia: 0, international: 0 };
  for (const article of articles) {
    if (article.mediaEnvironment === "thailand-domestic") counts.thailand += 1;
    else if (article.mediaEnvironment === "cambodia-domestic") counts.cambodia += 1;
    else if (article.mediaEnvironment === "international") counts.international += 1;
  }
  return { ...counts, total: counts.thailand + counts.cambodia + counts.international };
}
