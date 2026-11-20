import { buildAuditEvidenceDiagnosis } from "./audit-evidence-diagnosis.mjs";

const RETRYABLE_CAPTURE_STATUSES = new Set(["", "transient-failure", "captured-html"]);
const RETRYABLE_CITED_CAPTURE_STATUSES = new Set(["", "transient-failure", "unusable-extraction", "captured-html"]);
const USABLE_CAPTURE_STATUSES = new Set(["captured-html", "captured-document", "captured-text"]);

function compactLead(lead) {
  if (!lead) return null;
  return {
    id: lead.id,
    source: lead.source || "",
    sourceUrl: lead.sourceUrl || "",
    publishedIso: lead.publishedIso || null,
    title: lead.title || "",
    score: lead.score ?? null,
    distanceDays: lead.distanceDays ?? null,
    sameCategory: Boolean(lead.sameCategory),
    sharedTitleTokenCount: Number(lead.sharedTitleTokenCount || 0),
    sharedBodyTokenCount: Number(lead.sharedBodyTokenCount || 0),
    captureFound: Boolean(lead.captureFound),
    captureStatus: lead.captureStatus || "",
    captureQuality: lead.captureQuality || "",
  };
}

function highConfidenceLead(lead) {
  if (!lead) return false;
  const distanceDays = Number(lead.distanceDays);
  const sharedTitle = Number(lead.sharedTitleTokenCount || 0);
  const sharedBody = Number(lead.sharedBodyTokenCount || 0);
  const score = Number(lead.score || 0);
  if (lead.sameCategory && score >= 18) return true;
  if (lead.sameCategory && distanceDays === 0 && sharedBody >= 6) return true;
  if (lead.sameCategory && distanceDays <= 1 && sharedTitle >= 2) return true;
  if (!lead.sameCategory && distanceDays === 0 && sharedTitle >= 4 && sharedBody >= 8) return true;
  return false;
}

export async function recoverAuditEvidence({
  id,
  timeline = [],
  articles = [],
  archiveRoot,
  windowDays = 7,
  limit = 8,
  maxAttempts = 3,
  forceCapture = false,
  captureArticleFn = null,
} = {}) {
  if (!id) throw new Error("audit evidence recovery requires a timeline id");
  const diagnosisBefore = await buildAuditEvidenceDiagnosis({
    id,
    timeline,
    articles,
    archiveRoot,
    windowDays,
    limit,
  });

  const recoveryNeeded = new Set(["replacement-needed", "no-evidence", "partial"])
    .has(diagnosisBefore.evidenceState);
  if (!recoveryNeeded) {
    return {
      reviewOnly: true,
      targetId: id,
      recoveryState: "not-needed",
      selectedLead: null,
      attemptedCount: 0,
      attempts: [],
      skippedPersistent: [],
      rejectedLowConfidence: [],
      diagnosis: diagnosisBefore,
    };
  }

  const highConfidenceLeads = diagnosisBefore.existingArticleLeads.filter(highConfidenceLead);
  const rejectedLowConfidence = diagnosisBefore.existingArticleLeads
    .filter((lead) => !highConfidenceLead(lead))
    .map(compactLead);
  const uncapturedCited = diagnosisBefore.citedEvidence.filter((evidence) => !evidence.captureFound);
  const alreadyCaptured = highConfidenceLeads.find((lead) => lead.captureFound);
  const retryableCited = uncapturedCited.filter((evidence) => (
    forceCapture || RETRYABLE_CITED_CAPTURE_STATUSES.has(evidence.captureStatus || "")
  ));
  if (alreadyCaptured && retryableCited.length === 0) {
    return {
      reviewOnly: true,
      targetId: id,
      recoveryState: "existing-capture",
      selectedLead: compactLead(alreadyCaptured),
      attemptedCount: 0,
      attempts: [],
      skippedPersistent: [],
      rejectedLowConfidence,
      diagnosis: diagnosisBefore,
    };
  }

  const articleById = new Map(articles.map((article) => [article.id, article]));
  const cappedAttempts = Math.max(1, Math.min(10, Number(maxAttempts) || 3));
  const eligibleCited = [];
  const eligibleLeads = [];
  const skippedPersistent = [];
  for (const evidence of uncapturedCited) {
    const retryable = forceCapture || RETRYABLE_CITED_CAPTURE_STATUSES.has(evidence.captureStatus || "");
    if (retryable) eligibleCited.push(evidence);
    else skippedPersistent.push({ ...compactLead(evidence), kind: "cited" });
  }
  for (const lead of highConfidenceLeads) {
    const retryable = forceCapture || RETRYABLE_CAPTURE_STATUSES.has(lead.captureStatus || "");
    if (retryable) eligibleLeads.push(lead);
    else skippedPersistent.push({ ...compactLead(lead), kind: "lead" });
  }

  const attempts = [];
  let selectedLead = null;
  let selectedKind = null;
  let reusedExistingCapture = false;
  if (typeof captureArticleFn === "function") {
    const queue = [
      ...eligibleCited.map((evidence) => ({ evidence, kind: "cited" })),
      ...(alreadyCaptured ? [] : eligibleLeads.map((evidence) => ({ evidence, kind: "lead" }))),
    ];
    for (const { evidence, kind } of queue.slice(0, cappedAttempts)) {
      const article = articleById.get(evidence.id);
      if (!article) continue;
      try {
        const result = await captureArticleFn(article, { force: true });
        const status = result?.status || "";
        const usable = USABLE_CAPTURE_STATUSES.has(status);
        attempts.push({
          articleId: evidence.id,
          source: evidence.source || "",
          kind,
          status,
          usable,
          error: "",
        });
        if (usable) {
          selectedLead = evidence;
          selectedKind = kind;
          break;
        }
      } catch (error) {
        attempts.push({
          articleId: evidence.id,
          source: evidence.source || "",
          kind,
          status: "capture-error",
          usable: false,
          error: String(error?.message || error),
        });
      }
    }
  }
  if (!selectedLead && alreadyCaptured) {
    selectedLead = alreadyCaptured;
    selectedKind = "lead";
    reusedExistingCapture = true;
  }

  const diagnosisAfter = attempts.length
    ? await buildAuditEvidenceDiagnosis({
      id,
      timeline,
      articles,
      archiveRoot,
      windowDays,
      limit,
    })
    : diagnosisBefore;
  const capturedAfter = selectedLead
    ? (selectedKind === "cited"
      ? diagnosisAfter.citedEvidence.find((evidence) => evidence.id === selectedLead.id)
      : diagnosisAfter.existingArticleLeads.find((lead) => lead.id === selectedLead.id))
    : null;

  return {
    reviewOnly: true,
    targetId: id,
    recoveryState: capturedAfter?.captureFound
      ? (reusedExistingCapture
        ? "existing-capture"
        : (selectedKind === "cited" ? "captured-cited" : "captured-lead"))
      : "no-recoverable-lead",
    selectedLead: compactLead(capturedAfter || selectedLead),
    attemptedCount: attempts.length,
    attempts,
    skippedPersistent,
    rejectedLowConfidence,
    diagnosis: diagnosisAfter,
  };
}
