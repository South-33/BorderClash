import { fetchEvidence } from "./evidence-archive.mjs";

const USABLE_STATUSES = new Set(["captured-html", "captured-document", "captured-text"]);

export function summarizeEvidenceProbe(fetched, previewChars = 800) {
  const text = typeof fetched?.text === "string" ? fetched.text.trim() : "";
  const maxPreview = Math.max(0, Math.min(4000, Number(previewChars) || 0));
  return {
    usable: USABLE_STATUSES.has(fetched?.status),
    status: fetched?.status || "",
    requestedUrl: fetched?.requestedUrl || "",
    finalUrl: fetched?.finalUrl || "",
    canonicalUrl: fetched?.canonicalUrl || "",
    httpStatus: fetched?.httpStatus ?? null,
    contentType: fetched?.contentType || "",
    byteLength: fetched?.byteLength ?? null,
    textLength: text.length,
    redirectChain: fetched?.redirectChain || [],
    error: fetched?.error || "",
    preview: maxPreview && text ? text.slice(0, maxPreview) : "",
  };
}

export async function probeEvidenceUrl(url, options = {}) {
  if (!url) throw new Error("probe-source requires a URL");
  const fetched = await fetchEvidence(url, options);
  return summarizeEvidenceProbe(fetched, options.previewChars);
}
