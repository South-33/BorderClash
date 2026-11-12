export const EVIDENCE_RUBRIC_VERSION = "evidence-v2";

export const EVIDENCE_SCORE_GUIDE = Object.freeze([
  [100, "Verified: the article's material factual content is directly established or independently corroborated to a very high standard, with no material unresolved contradiction."],
  [90, "Very strong: multiple independent strong sources agree, or direct evidence has strong independent support; only minor uncertainty remains."],
  [80, "Strong: clear direct or primary evidence, or strong professional reporting, with useful support; some material detail may remain unconfirmed."],
  [70, "Credible: clear identifiable sourcing and plausible reporting, but the material claim still relies mainly on one evidence chain."],
  [60, "Plausible/attributed: the report is traceable and reasonable, but it mainly rests on one interested party, one source, or secondary reporting without independent corroboration."],
  [50, "Uncertain: plausible, but evidence is incomplete, materially disputed, anonymous, conflicting, or too thin for a positive confidence judgment."],
  [40, "Weak: significant sourcing gaps, unclear access, unresolved contradictions, or weak provenance materially reduce confidence."],
  [30, "Very weak: mostly allegation, hearsay, circular reporting, unclear provenance, or unsupported partisan assertion."],
  [20, "Likely unreliable: substantial contrary evidence or major internal/provenance problems make the claim more likely wrong than right."],
  [10, "Very likely false: strong credible evidence contradicts the claim, but conclusive falsification is not available."],
  [0, "False/fabricated: the specific claim or supporting material is demonstrably false, fabricated, or conclusively disproven."],
]);

export const EVIDENCE_ALLOWED_SCORES = new Set(EVIDENCE_SCORE_GUIDE.map(([score]) => score));

export const EVIDENCE_SCORING_RULES = Object.freeze([
  "Score the article/report as stored, not the publisher's general reputation, nationality, or viewpoint.",
  "Judge the material factual content carried by the stored title/summary. If important claims have different support levels, use the lower score that honestly represents the unresolved material claim.",
  "A primary source can strongly prove what that source itself said, published, acknowledged, ordered, or did; it does not automatically prove its disputed claims about another actor.",
  "A conflict party's material allegation about its opponent is capped at 60 until genuinely independent evidence corroborates the underlying fact.",
  "Several outlets repeating the same statement, wire copy, image, witness, or document are one evidence chain, not independent corroboration.",
  "Use 100 rarely. It requires the report's material factual content to be directly established or exceptionally well corroborated, with no material unresolved contradiction.",
  "Lack of evidence is uncertainty, not falsity. Use 0 or 10 only when credible contrary evidence supports that judgment.",
  "When evidence materially conflicts or two adjacent scores both seem defensible, use the lower score until the uncertainty is resolved.",
]);

export function evidenceRubricPrompt() {
  return "Evidence score (deciles only): 100 verified; 90 very strong; 80 strong; 70 credible; 60 plausible/attributed; 50 uncertain; 40 weak; 30 very weak; 20 likely unreliable; 10 very likely false; 0 false/fabricated. One article URL has one score. Score its material report, not the outlet. Opponent allegations cap at 60 without independent corroboration; repeated provenance is one evidence chain; 0/10 require credible contrary evidence; when between grades use the lower one.";
}

export function isEvidenceScore(value) {
  return EVIDENCE_ALLOWED_SCORES.has(value);
}
