import { riskLevelFromTiers } from "./military-assessment.mjs";

export function keyUpdateRecords(value) {
  if (!value || !Array.isArray(value.keyUpdates)) return [];
  if (value.keyUpdates.every((item) => typeof item === "string")) {
    return value.keyUpdates.map((text, index) => ({
      text,
      textTh: value.keyUpdatesTh?.[index],
      textKh: value.keyUpdatesKh?.[index],
      evidenceIds: null,
      legacy: true,
    }));
  }
  if (value.keyUpdates.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
    return value.keyUpdates.map((item) => ({
      text: item.text,
      textTh: item.textTh,
      textKh: item.textKh,
      evidenceIds: item.evidenceIds,
      legacy: false,
    }));
  }
  throw new Error("current summary keyUpdates must be all strings or all structured records");
}

export function currentSummaryPublic(value) {
  if (!value) return null;
  const updates = keyUpdateRecords(value);
  return {
    summary: value.summary,
    summaryTh: value.summaryTh,
    summaryKh: value.summaryKh,
    keyUpdates: updates.map(({ text }) => text),
    keyUpdatesTh: updates.map(({ textTh }) => textTh),
    keyUpdatesKh: updates.map(({ textKh }) => textKh),
    updatedAt: value.updatedAt,
  };
}

export function metricDisplay(metric) {
  if (!metric || metric.value == null) return "—";
  const number = Number(metric.value).toLocaleString("en-US");
  if (metric.qualifier === "MORE_THAN" || metric.qualifier === "AT_LEAST") return `${number}+`;
  return number;
}

export function currentImpactPublic(value, thailand, cambodia, lastResearchAt) {
  if (!value) return null;
  return {
    riskLevel: riskLevelFromTiers(thailand?.militaryAssessment?.tier, cambodia?.militaryAssessment?.tier),
    displacedCount: metricDisplay(value.displaced),
    deathCount: metricDisplay(value.deaths),
    updatedAt: lastResearchAt || value.updatedAt,
  };
}
