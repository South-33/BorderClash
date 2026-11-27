import { keyUpdateRecords } from "./current-shape.mjs";

export const CURRENT_CENTER_COPY_BUDGET = Object.freeze({
  maxKeyUpdates: 4,
  summaryGraphemes: Object.freeze({
    en: 280,
    th: 270,
    kh: 210,
  }),
  keyUpdateGraphemes: Object.freeze({
    en: 130,
    th: 115,
    kh: 95,
  }),
  totalGraphemes: Object.freeze({
    en: 800,
    th: 730,
    kh: 590,
  }),
});

const segmenters = new Map();

export function graphemeCount(value, locale = "en") {
  if (!value) return 0;
  let segmenter = segmenters.get(locale);
  if (!segmenter) {
    segmenter = new Intl.Segmenter(locale, { granularity: "grapheme" });
    segmenters.set(locale, segmenter);
  }
  return [...segmenter.segment(String(value))].length;
}

export function currentCenterCopyUsage(summary) {
  const updates = keyUpdateRecords(summary);
  const languages = {
    en: { locale: "en", summary: summary?.summary, field: "text" },
    th: { locale: "th", summary: summary?.summaryTh, field: "textTh" },
    kh: { locale: "km", summary: summary?.summaryKh, field: "textKh" },
  };

  const usage = { keyUpdates: updates.length, languages: {} };
  for (const [language, config] of Object.entries(languages)) {
    const summaryGraphemes = graphemeCount(config.summary, config.locale);
    const keyUpdateGraphemes = updates.map((update) => graphemeCount(update?.[config.field], config.locale));
    usage.languages[language] = {
      summaryGraphemes,
      keyUpdateGraphemes,
      totalGraphemes: summaryGraphemes + keyUpdateGraphemes.reduce((sum, value) => sum + value, 0),
    };
  }
  return usage;
}

export function currentCenterCopyBudgetIssues(summary) {
  const usage = currentCenterCopyUsage(summary);
  const issues = [];
  if (usage.keyUpdates > CURRENT_CENTER_COPY_BUDGET.maxKeyUpdates) {
    issues.push(`keyUpdates ${usage.keyUpdates} exceeds ${CURRENT_CENTER_COPY_BUDGET.maxKeyUpdates}`);
  }

  for (const language of ["en", "th", "kh"]) {
    const languageUsage = usage.languages[language];
    const summaryLimit = CURRENT_CENTER_COPY_BUDGET.summaryGraphemes[language];
    if (languageUsage.summaryGraphemes > summaryLimit) {
      issues.push(`${language} summary ${languageUsage.summaryGraphemes} graphemes exceeds ${summaryLimit}`);
    }

    const updateLimit = CURRENT_CENTER_COPY_BUDGET.keyUpdateGraphemes[language];
    languageUsage.keyUpdateGraphemes.forEach((actual, index) => {
      if (actual > updateLimit) {
        issues.push(`${language} keyUpdate[${index}] ${actual} graphemes exceeds ${updateLimit}`);
      }
    });

    const totalLimit = CURRENT_CENTER_COPY_BUDGET.totalGraphemes[language];
    if (languageUsage.totalGraphemes > totalLimit) {
      issues.push(`${language} total ${languageUsage.totalGraphemes} graphemes exceeds ${totalLimit}`);
    }
  }
  return issues;
}
