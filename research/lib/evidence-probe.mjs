import { fetchEvidence } from "./evidence-archive.mjs";

const USABLE_STATUSES = new Set(["captured-html", "captured-document", "captured-text"]);

export function summarizeEvidenceProbe(fetched, previewChars = 800) {
  const text = typeof fetched?.text === "string" ? fetched.text.trim() : "";
  const maxPreview = Math.max(0, Math.min(4000, Number(previewChars) || 0));
  const requestedUrl = fetched?.requestedUrl || "";
  const finalUrl = fetched?.finalUrl || "";
  const resolved = Boolean(requestedUrl && finalUrl && requestedUrl !== finalUrl);
  const usable = USABLE_STATUSES.has(fetched?.status);
  return {
    usable,
    resolved,
    status: fetched?.status || "",
    requestedUrl,
    finalUrl,
    canonicalUrl: fetched?.canonicalUrl || "",
    httpStatus: fetched?.httpStatus ?? null,
    contentType: fetched?.contentType || "",
    byteLength: fetched?.byteLength ?? null,
    textLength: text.length,
    redirectChain: fetched?.redirectChain || [],
    error: fetched?.error || "",
    preview: maxPreview && text ? text.slice(0, maxPreview) : "",
    nextAction: usable
      ? "Use this source as evidence input; ingest/capture it if it belongs in the canonical record."
      : resolved
        ? "The redirect resolved even though the publisher body is unavailable. Use finalUrl as provenance and seek accessible primary or independent corroboration; do not repeat search variants just to rediscover this lead."
        : "The source could not be read or resolved here. Try another accessible source or corroboration; lack of access is not evidence against the claim.",
  };
}

export async function probeEvidenceUrl(url, options = {}) {
  if (!url) throw new Error("probe-source requires a URL");
  const fetched = await fetchEvidence(url, options);
  return summarizeEvidenceProbe(fetched, options.previewChars);
}
