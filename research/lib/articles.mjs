export function normalizeArticleUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./u, "");
    const origin = `https://${host}`;
    const pathname = url.pathname.replace(/\/+$/u, "") || "/";
    const id = url.searchParams.get("id");

    // These publishers encode article identity in the path or article ID;
    // the remaining path/query variants are navigation or headline changes.
    if (host === "mfa.go.th" && pathname.startsWith("/en/content/")) {
      return `${origin}${pathname}`;
    }
    if (host === "channelnewsasia.com") {
      const match = pathname.match(/-(\d{6,})$/u);
      if (match) return `${origin}/article/${match[1]}`;
    }
    if (host === "bernama.com" && /^\/en\/(?:world\/)?news\.php$/u.test(pathname) && id) {
      return `${origin}/en/news.php?id=${id}`;
    }
    if (host === "kuna.net.kw" && /^\/articledetails\.aspx$/iu.test(pathname) && id) {
      return `${origin}/ArticleDetails.aspx?id=${id}&language=${(url.searchParams.get("language") || url.searchParams.get("Language") || "").toLowerCase()}`;
    }

    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_|^(?:fbclid|gclid|mc_cid|mc_eid)$/iu.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return `${origin}${pathname}${url.search}`;
  } catch {
    return raw.replace(/\/$/u, "");
  }
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
