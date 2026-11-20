function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[๐-๙]/gu, (digit) => String(digit.codePointAt(0) - 0x0e50))
    .replace(/[០-៩]/gu, (digit) => String(digit.codePointAt(0) - 0x17e0))
    .replace(/\u200b/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function exactTimePatterns(timeOfDay) {
  const match = /^(\d{2}):(\d{2})$/u.exec(String(timeOfDay || ""));
  if (!match) return [];
  const hour24 = Number(match[1]);
  const minute = match[2];
  if (!Number.isInteger(hour24) || hour24 > 23) return [];

  const hour24Plain = String(hour24);
  const hour12Value = hour24 % 12 || 12;
  const hour12 = String(hour12Value);
  const meridiem = hour24 < 12 ? "a\\.?m\\.?" : "p\\.?m\\.?";
  const minutePart = escapeRegex(minute);
  const patterns = [
    new RegExp(`(?<!\\d)0?${escapeRegex(hour24Plain)}[:.]${minutePart}(?!\\d)`, "iu"),
    new RegExp(`(?<!\\d)0?${escapeRegex(hour24Plain)}\\s+${minutePart}(?!\\d)`, "iu"),
    new RegExp(`(?<!\\d)${escapeRegex(hour12)}[:.]${minutePart}\\s*${meridiem}(?!\\p{L})`, "iu"),
  ];
  if (minute === "00") {
    patterns.push(new RegExp(`(?<!\\d)${escapeRegex(hour12)}\\s*${meridiem}(?!\\p{L})`, "iu"));
    if (hour24 < 12) {
      patterns.push(new RegExp(`(?<!\\d)0?${escapeRegex(hour12)}\\s*\\u1796\\u17d2\\u179a\\u17b9\\u1780`, "iu"));
    }
  }
  return patterns;
}

export function capturedTimeMatches(timeOfDay, captures = []) {
  const patterns = exactTimePatterns(timeOfDay);
  if (!patterns.length) return [];
  return captures
    .filter((capture) => capture?.captureFound && capture?.text)
    .filter((capture) => {
      const text = normalizeText(capture.text);
      return patterns.some((pattern) => pattern.test(text));
    })
    .map((capture) => capture.articleId);
}

export function auditReviewPrecheck(packet, capturedEvidence) {
  if (!packet?.id) throw new Error("audit review precheck requires an audit packet");
  const blockers = [];
  const warnings = [];
  const deletion = packet.proposedAction === "delete";
  const captures = Array.isArray(capturedEvidence?.captures) ? capturedEvidence.captures : [];
  const articleCount = Number(capturedEvidence?.articleCount || 0);
  const capturedCount = Number(capturedEvidence?.capturedCount || 0);
  const uncapturedArticleIds = captures.filter((capture) => !capture.captureFound).map((capture) => capture.articleId);
  const missingEvidenceIds = Array.isArray(packet.evidence?.missingEvidenceIds) ? packet.evidence.missingEvidenceIds : [];
  const missingDirectSourceUrls = Array.isArray(packet.evidence?.missingDirectSourceUrls) ? packet.evidence.missingDirectSourceUrls : [];

  if (missingEvidenceIds.length) {
    const issue = { code: deletion ? "deletion-missing-evidence-ids" : "missing-evidence-ids", values: missingEvidenceIds };
    if (deletion) warnings.push(issue);
    else blockers.push(issue);
  }
  if (missingDirectSourceUrls.length) {
    const issue = { code: deletion ? "deletion-missing-direct-source-urls" : "missing-direct-source-urls", values: missingDirectSourceUrls };
    if (deletion) warnings.push(issue);
    else blockers.push(issue);
  }
  if (articleCount === 0) {
    if (deletion) warnings.push({ code: "deletion-without-cited-evidence" });
    else blockers.push({ code: "no-cited-evidence" });
  } else if (capturedCount === 0) {
    const issue = { code: deletion ? "deletion-without-usable-captured-evidence" : "no-usable-captured-evidence", articleIds: captures.map((capture) => capture.articleId) };
    if (deletion) warnings.push(issue);
    else blockers.push(issue);
  }
  else if (uncapturedArticleIds.length) warnings.push({ code: "some-cited-evidence-uncaptured", articleIds: uncapturedArticleIds });

  const exactTime = !deletion && packet.kind === "timeline" ? String(packet.record?.timeOfDay || "").trim() : "";
  const exactTimeMatchedArticleIds = exactTime ? capturedTimeMatches(exactTime, captures) : [];
  if (exactTime && exactTimePatterns(exactTime).length && exactTimeMatchedArticleIds.length === 0) {
    blockers.push({ code: "exact-time-not-found-in-captured-evidence", timeOfDay: exactTime });
  }

  return {
    ok: blockers.length === 0,
    recordId: packet.id,
    kind: packet.kind,
    proposedAction: packet.proposedAction || null,
    articleCount,
    capturedCount,
    uncapturedArticleIds,
    exactTime: exactTime || null,
    exactTimeMatchedArticleIds,
    blockers,
    warnings,
    note: "Exact-time matching is a lexical precheck only; a match is not proof and the locked reviewer must still assess context.",
  };
}
