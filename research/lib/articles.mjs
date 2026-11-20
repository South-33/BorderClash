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
    if (host === "world.thaipbs.or.th") {
      const match = pathname.match(/^\/detail\/(?:[^/]+\/)?(\d+)$/u);
      if (match) return `${origin}/detail/${match[1]}`;
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

export function publisherArticleIdentity(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./u, "");
    const pathname = url.pathname.replace(/\/+$/u, "") || "/";

    if (/(?:^|\.)freshnewsasia\.com$/u.test(host)) {
      const match = pathname.match(/\/(\d{5,})(?:-|$)/u);
      if (match) return `freshnewsasia:${match[1]}`;
    }
    if (host === "thaipbs.or.th") {
      const match = pathname.match(/^\/news\/content\/(\d+)$/u);
      if (match) return `thaipbs:${match[1]}`;
    }
    if (host === "world.thaipbs.or.th") {
      const match = pathname.match(/^\/detail\/(?:[^/]+\/)?(\d+)$/u);
      if (match) return `thaipbsworld:${match[1]}`;
    }
    if (host === "khmertimeskh.com") {
      const match = pathname.match(/^\/(\d{6,})(?:\/|$)/u);
      if (match) return `khmertimes:${match[1]}`;
    }
    if (host === "kampucheathmey.com") {
      const match = pathname.match(/\/(\d{5,})(?:\/|$)/u);
      if (match) return `kampucheathmey:${match[1]}`;
    }
    if (host === "pna.gov.ph") {
      const match = pathname.match(/^\/articles\/(\d+)$/u);
      if (match) return `pna:${match[1]}`;
    }
  } catch {
    return "";
  }
  return "";
}

const provenanceIdPattern = /^[a-z0-9][a-z0-9._:-]{2,119}$/u;

export function isValidProvenanceId(value) {
  return typeof value === "string" && provenanceIdPattern.test(value);
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
