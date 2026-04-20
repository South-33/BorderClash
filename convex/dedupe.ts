"use node";

export const ARTICLE_DEDUP_LOOKBACK_MS = 36 * 60 * 60 * 1000;
const TRACKING_QUERY_PARAM_PREFIXES = ["utm_"];
const TRACKING_QUERY_PARAMS = new Set([
    "fbclid",
    "gclid",
    "igshid",
    "mc_cid",
    "mc_eid",
    "srsltid",
    "at_campaign",
    "at_creation",
    "at_format",
    "at_medium",
    "at_variant",
    "at_channel",
]);

export const normalizeTitleForDedup = (title: string): string =>
    title
        .toLowerCase()
        .replace(/[""'']/g, "\"")
        .replace(/[^a-z0-9\u0E00-\u0E7F\u1780-\u17FF\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

export const getCanonicalSourceDomain = (rawUrl?: string): string | null => {
    if (!rawUrl) return null;

    try {
        const url = new URL(rawUrl.trim());
        return url.hostname.toLowerCase().replace(/^www\./, "");
    } catch {
        return null;
    }
};

export const canonicalizeArticleUrl = (rawUrl?: string): string => {
    if (!rawUrl) return "";

    try {
        const url = new URL(rawUrl.trim());
        url.hash = "";
        url.hostname = url.hostname.toLowerCase();

        if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
            url.port = "";
        }

        const nextParams = new URLSearchParams();
        for (const [key, value] of url.searchParams.entries()) {
            const lowerKey = key.toLowerCase();
            if (TRACKING_QUERY_PARAMS.has(lowerKey)) continue;
            if (TRACKING_QUERY_PARAM_PREFIXES.some((prefix) => lowerKey.startsWith(prefix))) continue;
            nextParams.append(key, value);
        }
        url.search = nextParams.toString() ? `?${nextParams.toString()}` : "";

        if (url.pathname.length > 1) {
            url.pathname = url.pathname.replace(/\/+$/, "");
        }

        return url.toString();
    } catch {
        return rawUrl.trim();
    }
};

const arePublishedTimesClose = (lhs?: number, rhs?: number): boolean =>
    typeof lhs === "number"
    && Number.isFinite(lhs)
    && typeof rhs === "number"
    && Number.isFinite(rhs)
    && Math.abs(lhs - rhs) <= ARTICLE_DEDUP_LOOKBACK_MS;

export type DuplicateCandidate = {
    title: string;
    sourceUrl?: string;
    publishedAt?: number;
    status?: string;
};

export function findVerifiedDuplicateCandidate({
    currentTitle,
    candidateTitle,
    candidateUrl,
    candidatePublishedAt,
    candidates,
}: {
    currentTitle: string;
    candidateTitle?: string;
    candidateUrl?: string;
    candidatePublishedAt?: number;
    candidates: DuplicateCandidate[];
}) {
    const candidateCanonicalUrl = canonicalizeArticleUrl(candidateUrl);
    const candidateTitleKey = candidateTitle ? normalizeTitleForDedup(candidateTitle) : "";
    const candidateDomain = getCanonicalSourceDomain(candidateUrl);

    for (const article of candidates) {
        if (article.title === currentTitle) continue;
        if (article.status && article.status !== "active" && article.status !== "unverified") continue;

        const articleCanonicalUrl = canonicalizeArticleUrl(article.sourceUrl);
        if (candidateCanonicalUrl && articleCanonicalUrl === candidateCanonicalUrl) {
            return {
                duplicateTitle: article.title,
                duplicateUrl: article.sourceUrl,
                reason: "canonical_url",
            };
        }

        if (!candidateTitleKey) continue;

        const articleTitleKey = normalizeTitleForDedup(article.title);
        if (articleTitleKey !== candidateTitleKey) continue;

        const sameDomain = candidateDomain !== null && candidateDomain === getCanonicalSourceDomain(article.sourceUrl);
        const closePublishTime = arePublishedTimesClose(candidatePublishedAt, article.publishedAt);

        if (sameDomain || closePublishTime) {
            return {
                duplicateTitle: article.title,
                duplicateUrl: article.sourceUrl,
                reason: sameDomain ? "verified_title_same_source" : "verified_title_same_time",
            };
        }
    }

    return null;
}
