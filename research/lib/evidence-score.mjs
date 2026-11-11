export const EVIDENCE_RUBRIC_VERSION = "evidence-v1";

export const EVIDENCE_SCORES = Object.freeze({
  VERIFIED: 90,
  ATTRIBUTED: 75,
  LIMITED: 55,
  WEAK: 30,
});

export const EVIDENCE_ALLOWED_SCORES = new Set(Object.values(EVIDENCE_SCORES));

export function normalizeEvidenceScore(value, status) {
  if (status === "unverified") return EVIDENCE_SCORES.WEAK;
  const score = Number(value);
  if (!Number.isFinite(score)) return EVIDENCE_SCORES.WEAK;
  if (score >= 85) return EVIDENCE_SCORES.VERIFIED;
  if (score >= 70) return EVIDENCE_SCORES.ATTRIBUTED;
  if (score >= 45) return EVIDENCE_SCORES.LIMITED;
  return EVIDENCE_SCORES.WEAK;
}
