"use node";

import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 320_000;
const MAX_RSS_BYTES = 160_000;
const MAX_REDIRECTS = 4;
const MAX_TEXT_SNIPPET = 2_000;

type DirectEvidenceStatus = "ok" | "dead" | "blocked" | "error" | "unsafe";

export type SourceEvidence = {
    requestedUrl: string;
    gatheredAt: string;
    direct: {
        status: DirectEvidenceStatus;
        httpStatus?: number;
        finalUrl?: string;
        title?: string;
        description?: string;
        publishedAt?: string;
        textSnippet?: string;
        reason?: string;
    };
    googleNews: {
        query: string;
        items: Array<{
            title: string;
            source?: string;
            sourceUrl?: string;
            publishedAt?: string;
        }>;
        error?: string;
    };
};

function decodeHtmlEntities(value: string): string {
    return value
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/&#(\d+);/g, (match, raw: string) => {
            const codePoint = Number(raw);
            return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
                ? String.fromCodePoint(codePoint)
                : match;
        })
        .replace(/&#x([0-9a-f]+);/gi, (match, raw: string) => {
            const codePoint = parseInt(raw, 16);
            return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
                ? String.fromCodePoint(codePoint)
                : match;
        })
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">");
}

function cleanText(value: string | undefined | null): string | undefined {
    if (!value) return undefined;
    const cleaned = decodeHtmlEntities(value)
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return cleaned || undefined;
}

function extractMeta(html: string, name: string): string | undefined {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
        new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["']`, "i"),
    ];
    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match?.[1]) return cleanText(match[1]);
    }
    return undefined;
}

function extractPageMetadata(html: string): Pick<SourceEvidence["direct"], "title" | "description" | "publishedAt" | "textSnippet"> {
    const title = extractMeta(html, "og:title")
        || extractMeta(html, "twitter:title")
        || cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
    const description = extractMeta(html, "og:description")
        || extractMeta(html, "description")
        || extractMeta(html, "twitter:description");
    const publishedAt = extractMeta(html, "article:published_time")
        || extractMeta(html, "date")
        || cleanText(html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1])
        || cleanText(html.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1]);

    const mainish = html.match(/<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)>/i)?.[1] || html;
    const textSnippet = cleanText(mainish)?.slice(0, MAX_TEXT_SNIPPET);

    return { title, description, publishedAt, textSnippet };
}

function isPrivateIpv4(address: string): boolean {
    const parts = address.split(".").map(Number);
    if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return true;
    const [a, b] = parts;
    return a === 0
        || a === 10
        || a === 127
        || (a === 100 && b >= 64 && b <= 127)
        || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && b === 168)
        || (a === 198 && (b === 18 || b === 19))
        || a >= 224;
}

function isPrivateIp(address: string): boolean {
    const version = isIP(address);
    if (version === 4) return isPrivateIpv4(address);
    if (version === 6) {
        const normalized = address.toLowerCase();
        return normalized === "::" || normalized === "::1"
            || normalized.startsWith("fc")
            || normalized.startsWith("fd")
            || /^fe[89ab]/.test(normalized);
    }
    return true;
}

async function validatePublicUrl(rawUrl: string): Promise<URL> {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error(`unsupported protocol: ${url.protocol}`);
    }
    if (url.username || url.password) throw new Error("embedded URL credentials are not allowed");
    if (url.port && !((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443"))) {
        throw new Error("non-standard web port is not allowed");
    }

    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!hostname
        || hostname === "localhost"
        || hostname.endsWith(".localhost")
        || hostname.endsWith(".local")
        || hostname.endsWith(".internal")
        || hostname.endsWith(".home.arpa")) {
        throw new Error("private/local hostname is not allowed");
    }

    if (isIP(hostname)) {
        if (isPrivateIp(hostname)) throw new Error("private/reserved IP is not allowed");
        return url;
    }

    const resolved = await lookup(hostname, { all: true, verbatim: true });
    if (resolved.length === 0 || resolved.some(result => isPrivateIp(result.address))) {
        throw new Error("hostname resolves to a private/reserved IP");
    }
    return url;
}

async function readTextLimited(response: Response, maxBytes: number): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) return "";
    const decoder = new TextDecoder("utf-8", { fatal: false });
    let total = 0;
    let output = "";
    try {
        while (total < maxBytes) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;
            const remaining = maxBytes - total;
            const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value;
            total += chunk.byteLength;
            output += decoder.decode(chunk, { stream: true });
            if (chunk.byteLength < value.byteLength) break;
        }
        output += decoder.decode();
    } finally {
        if (total >= maxBytes) {
            try { await reader.cancel(); } catch { /* best effort */ }
        }
    }
    return output;
}

async function fetchDirectEvidence(rawUrl: string): Promise<SourceEvidence["direct"]> {
    let currentUrl: URL;
    try {
        currentUrl = await validatePublicUrl(rawUrl);
    } catch (error: any) {
        return { status: "unsafe", reason: error?.message || String(error) };
    }

    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
            const response = await fetch(currentUrl, {
                method: "GET",
                redirect: "manual",
                signal: controller.signal,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36 BorderClashVerifier/1.0",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
                    "Accept-Language": "en-US,en;q=0.9",
                },
            });

            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get("location");
                if (!location) return { status: "error", httpStatus: response.status, finalUrl: currentUrl.toString(), reason: "redirect without Location" };
                if (redirectCount >= MAX_REDIRECTS) return { status: "error", httpStatus: response.status, finalUrl: currentUrl.toString(), reason: "too many redirects" };
                try {
                    currentUrl = await validatePublicUrl(new URL(location, currentUrl).toString());
                } catch (error: any) {
                    return { status: "unsafe", httpStatus: response.status, finalUrl: currentUrl.toString(), reason: `unsafe redirect: ${error?.message || error}` };
                }
                continue;
            }

            if (response.status === 404 || response.status === 410) {
                return { status: "dead", httpStatus: response.status, finalUrl: currentUrl.toString(), reason: `HTTP ${response.status}` };
            }
            if (response.status === 401 || response.status === 403 || response.status === 429) {
                return { status: "blocked", httpStatus: response.status, finalUrl: currentUrl.toString(), reason: `HTTP ${response.status}` };
            }
            if (!response.ok) {
                return { status: "error", httpStatus: response.status, finalUrl: currentUrl.toString(), reason: `HTTP ${response.status}` };
            }

            const contentType = (response.headers.get("content-type") || "").toLowerCase();
            if (contentType && !contentType.includes("text/") && !contentType.includes("html") && !contentType.includes("xml")) {
                return { status: "error", httpStatus: response.status, finalUrl: currentUrl.toString(), reason: `unsupported content type: ${contentType}` };
            }

            const html = await readTextLimited(response, MAX_HTML_BYTES);
            return {
                status: "ok",
                httpStatus: response.status,
                finalUrl: currentUrl.toString(),
                ...extractPageMetadata(html),
            };
        } catch (error: any) {
            const reason = error?.name === "AbortError" ? `timeout after ${FETCH_TIMEOUT_MS}ms` : (error?.message || String(error));
            return { status: "error", finalUrl: currentUrl.toString(), reason };
        } finally {
            clearTimeout(timeout);
        }
    }

    return { status: "error", finalUrl: currentUrl.toString(), reason: "redirect loop" };
}

function parseGoogleNewsItems(xml: string): SourceEvidence["googleNews"]["items"] {
    const items: SourceEvidence["googleNews"]["items"] = [];
    for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
        const item = match[1];
        const title = cleanText(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1]);
        if (!title) continue;
        const sourceMatch = item.match(/<source(?:\s+url=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/source>/i);
        const source = cleanText(sourceMatch?.[2]);
        const sourceUrl = cleanText(sourceMatch?.[1]);
        const publishedAt = cleanText(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]);
        items.push({ title, source, sourceUrl, publishedAt });
        if (items.length >= 5) break;
    }
    return items;
}

async function fetchGoogleNewsEvidence(storedTitle: string, sourceUrl: string): Promise<SourceEvidence["googleNews"]> {
    let hostname = "";
    try { hostname = new URL(sourceUrl).hostname.replace(/^www\./i, ""); } catch { /* malformed URLs are handled by direct evidence */ }
    const query = `"${storedTitle.slice(0, 300)}"${hostname ? ` ${hostname}` : ""}`;
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(rssUrl, {
            signal: controller.signal,
            headers: {
                "User-Agent": "BorderClashVerifier/1.0",
                "Accept": "application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.5",
            },
        });
        if (!response.ok) return { query, items: [], error: `Google News HTTP ${response.status}` };
        const xml = await readTextLimited(response, MAX_RSS_BYTES);
        return { query, items: parseGoogleNewsItems(xml) };
    } catch (error: any) {
        return { query, items: [], error: error?.name === "AbortError" ? `timeout after ${FETCH_TIMEOUT_MS}ms` : (error?.message || String(error)) };
    } finally {
        clearTimeout(timeout);
    }
}

export async function collectSourceEvidence(sourceUrl: string, storedTitle: string): Promise<SourceEvidence> {
    const [direct, googleNews] = await Promise.all([
        fetchDirectEvidence(sourceUrl),
        fetchGoogleNewsEvidence(storedTitle, sourceUrl),
    ]);
    return {
        requestedUrl: sourceUrl,
        gatheredAt: new Date().toISOString(),
        direct,
        googleNews,
    };
}

export function formatSourceEvidence(evidence: SourceEvidence): string {
    const direct = evidence.direct;
    const lines = [
        `Direct fetch status: ${direct.status}${direct.httpStatus ? ` (HTTP ${direct.httpStatus})` : ""}`,
        direct.finalUrl ? `Direct final URL: ${direct.finalUrl}` : null,
        direct.title ? `Direct page title: ${direct.title}` : null,
        direct.description ? `Direct description: ${direct.description}` : null,
        direct.publishedAt ? `Direct published time: ${direct.publishedAt}` : null,
        direct.textSnippet ? `Direct text excerpt: ${direct.textSnippet}` : null,
        direct.reason ? `Direct fetch note: ${direct.reason}` : null,
        `Google News RSS query: ${evidence.googleNews.query}`,
    ].filter(Boolean) as string[];

    if (evidence.googleNews.items.length === 0) {
        lines.push(`Google News RSS results: none${evidence.googleNews.error ? ` (${evidence.googleNews.error})` : ""}`);
    } else {
        lines.push("Google News RSS results:");
        for (const [index, item] of evidence.googleNews.items.entries()) {
            lines.push(`${index + 1}. ${item.title}${item.source ? ` | source=${item.source}` : ""}${item.sourceUrl ? ` | sourceUrl=${item.sourceUrl}` : ""}${item.publishedAt ? ` | published=${item.publishedAt}` : ""}`);
        }
    }
    return lines.join("\n");
}
