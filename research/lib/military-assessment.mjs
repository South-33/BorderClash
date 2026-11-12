export const MILITARY_RUBRIC_VERSION = "military-v1";

const MILITARY_TIERS = Object.freeze({
  CALM: { score: 10, posture: "PEACEFUL", meaning: "Routine presence or diplomacy; no material military change." },
  WATCHFUL: { score: 25, posture: "PEACEFUL", meaning: "Heightened monitoring or readiness without a material force change." },
  FORTIFIED: { score: 40, posture: "DEFENSIVE", meaning: "New or continuing fortifications, fencing, trenches, or unit reorganization without new fighting." },
  REINFORCED: { score: 50, posture: "DEFENSIVE", meaning: "Material troop or heavy-equipment reinforcement without firing." },
  INCIDENT: { score: 62, posture: "ESCALATED", meaning: "A verified isolated armed incident or similarly acute military event." },
  COMBAT: { score: 68, posture: "ESCALATED", meaning: "Repeated or ongoing exchanges of fire without a verified sustained offensive by this side." },
  OFFENSIVE: { score: 80, posture: "AGGRESSIVE", meaning: "Verified cross-border strike, incursion, or territorial seizure initiated by this side." },
  MAJOR_OFFENSIVE: { score: 95, posture: "AGGRESSIVE", meaning: "Sustained multi-location or heavy offensive operations initiated by this side." },
});

export function militaryAssessmentFor(tier) {
  return MILITARY_TIERS[tier] || null;
}

export function riskLevelFromTiers(...tiers) {
  const scores = tiers.map((tier) => militaryAssessmentFor(tier)?.score ?? 0);
  const highest = Math.max(0, ...scores);
  if (highest >= 70) return "CRITICAL";
  if (highest >= 56) return "ELEVATED";
  return "LOW";
}
