import { join, resolve } from "node:path";
import { listFiles, readJson, readJsonl } from "./files.mjs";
import { getLocalizedTextIssue } from "./language.mjs";

export const VISIBLE_NEWS_STATUSES = new Set(["active", "unverified"]);

const PLAIN_LANGUAGE_JARGON = [
  /\bnon-kinetic\b/giu,
  /\bkinetic(?: operations?| clashes?)?\b/giu,
  /\bconfidence-building\b/giu,
  /\b(?:administrative )?force restructuring\b/giu,
  /\bsovereignty violations?\b/giu,
  /\bterritorial violations?\b/giu,
  /\bdiplomatically contentious\b/giu,
  /\bfrontier sectors?\b/giu,
  /\bexcavat(?:e|ed|ing)\b/giu,
  /\blodg(?:e|ed|ing) diplomatic protests?\b/giu,
];

const BORDER_RELEVANCE_SIGNAL = /\b(?:border|ceasefire|displac\w*|military|army|troop\w*|mine\w*|landmine\w*|fenc\w*|trench\w*|territor\w*|sovereignt\w*|asean|talks?|tension\w*|closure|crossing\w*|security|attack\w*|conflict\w*|peace\w*|protest\w*|dispute\w*|maritime|unclos|repatriat\w*|citizen\w*|neutral(?:ity)?|general assembly)\b/iu;
const THAI_OR_KHMER_RE = /[\u0E00-\u0E7F\u1780-\u17FF]/u;

export function selectVisibleNews(records, limit = 20) {
  return records
    .filter((row) => VISIBLE_NEWS_STATUSES.has(row.status))
    .sort((a, b) => {
      const published = (b.publishedAt || b.fetchedAt || 0) - (a.publishedAt || a.fetchedAt || 0);
      if (published !== 0) return published;
      return (b.fetchedAt || 0) - (a.fetchedAt || 0);
    })
    .slice(0, limit);
}

export function isBorderRelevantNews(row) {
  return BORDER_RELEVANCE_SIGNAL.test(String(row?.titleEn || row?.title || ""));
}

function englishSentences(value) {
  return String(value || "")
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function wordCount(value) {
  return String(value || "").trim().split(/\s+/u).filter(Boolean).length;
}

function currentAnalysisText(analyses) {
  return [
    analyses.thailand?.officialNarrative,
    analyses.thailand?.postureRationale,
    analyses.cambodia?.officialNarrative,
    analyses.cambodia?.postureRationale,
    analyses.neutral?.generalSummary,
    ...(analyses.neutral?.keyEvents || []),
  ].filter(Boolean);
}

function localizedAnalysisValues(analyses) {
  return [
    ["analysis.thailand.officialNarrativeTh", analyses.thailand?.officialNarrativeTh, "th"],
    ["analysis.thailand.officialNarrativeKh", analyses.thailand?.officialNarrativeKh, "kh"],
    ["analysis.thailand.postureRationaleTh", analyses.thailand?.postureRationaleTh, "th"],
    ["analysis.thailand.postureRationaleKh", analyses.thailand?.postureRationaleKh, "kh"],
    ["analysis.cambodia.officialNarrativeTh", analyses.cambodia?.officialNarrativeTh, "th"],
    ["analysis.cambodia.officialNarrativeKh", analyses.cambodia?.officialNarrativeKh, "kh"],
    ["analysis.cambodia.postureRationaleTh", analyses.cambodia?.postureRationaleTh, "th"],
    ["analysis.cambodia.postureRationaleKh", analyses.cambodia?.postureRationaleKh, "kh"],
    ["analysis.neutral.generalSummaryTh", analyses.neutral?.generalSummaryTh, "th"],
    ["analysis.neutral.generalSummaryKh", analyses.neutral?.generalSummaryKh, "kh"],
    ...(analyses.neutral?.keyEventsTh || []).map((value, index) => [`analysis.neutral.keyEventsTh[${index}]`, value, "th"]),
    ...(analyses.neutral?.keyEventsKh || []).map((value, index) => [`analysis.neutral.keyEventsKh[${index}]`, value, "kh"]),
  ];
}

export function assessContentQuality({ news, analyses }) {
  const issues = [];
  const visible = {
    thailand: selectVisibleNews(news.thailand || []),
    cambodia: selectVisibleNews(news.cambodia || []),
  };

  let unsafeEnglishFallbacks = 0;
  let sourceHeadlineFallbacks = 0;
  const sourceHeadlineExamples = [];
  let missingThai = 0;
  let missingKhmer = 0;
  let localizedIssues = 0;
  const relevanceReviewCandidates = [];

  for (const [country, rows] of Object.entries(visible)) {
    for (const row of rows) {
      if (typeof row.titleEn !== "string" || !row.titleEn.trim()) {
        sourceHeadlineFallbacks += 1;
        if (sourceHeadlineExamples.length < 10) {
          sourceHeadlineExamples.push(`${country}:${row.id}:${row.title || ""}`);
        }
        if (THAI_OR_KHMER_RE.test(String(row.title || ""))) {
          unsafeEnglishFallbacks += 1;
          issues.push(`${country}:${row.id}.titleEn:cross-language-fallback`);
        }
      }
      const thIssue = getLocalizedTextIssue(row.titleTh, "th");
      const khIssue = getLocalizedTextIssue(row.titleKh, "kh");
      if (thIssue) {
        missingThai += thIssue === "missing" ? 1 : 0;
        localizedIssues += 1;
        issues.push(`${country}:${row.id}.titleTh:${thIssue}`);
      }
      if (khIssue) {
        missingKhmer += khIssue === "missing" ? 1 : 0;
        localizedIssues += 1;
        issues.push(`${country}:${row.id}.titleKh:${khIssue}`);
      }

      const readerTitle = row.titleEn || row.title || "";
      if (!isBorderRelevantNews(row)) {
        relevanceReviewCandidates.push({
          country,
          id: row.id,
          title: readerTitle,
        });
      }
    }
  }

  for (const [location, value, language] of localizedAnalysisValues(analyses)) {
    const issue = getLocalizedTextIssue(value, language);
    if (issue) {
      localizedIssues += 1;
      issues.push(`${location}:${issue}`);
    }
  }

  const english = currentAnalysisText(analyses);
  const jargon = [];
  for (const value of english) {
    for (const pattern of PLAIN_LANGUAGE_JARGON) {
      pattern.lastIndex = 0;
      for (const match of value.matchAll(pattern)) jargon.push(match[0]);
    }
  }

  const sentenceLengths = english.flatMap(englishSentences).map(wordCount);
  const maxEnglishSentenceWords = sentenceLengths.length ? Math.max(...sentenceLengths) : 0;
  const longEnglishSentences = sentenceLengths.filter((count) => count > 32).length;
  const penalty = (unsafeEnglishFallbacks + missingThai + missingKhmer) * 2
    + localizedIssues * 3
    + jargon.length * 3
    + longEnglishSentences;

  return {
    score: Math.max(0, 100 - penalty),
    visibleNews: visible.thailand.length + visible.cambodia.length,
    unsafeEnglishFallbacks,
    sourceHeadlineFallbacks,
    sourceHeadlineExamples,
    missingThai,
    missingKhmer,
    localizedIssues,
    jargonHits: jargon.length,
    jargon: [...new Set(jargon)],
    longEnglishSentences,
    maxEnglishSentenceWords,
    relevanceReviewCandidates,
    issues: issues.slice(0, 50),
  };
}

export async function loadContentQuality(dataRoot = resolve("data")) {
  const analyses = Object.fromEntries(
    await Promise.all(["thailand", "cambodia", "neutral"].map(async (name) => [
      name,
      await readJson(join(dataRoot, "analysis", `${name}.json`)),
    ])),
  );
  const news = { thailand: [], cambodia: [], international: [] };
  for (const file of await listFiles(join(dataRoot, "news"), ".jsonl")) {
    const country = file.endsWith("thailand.jsonl")
      ? "thailand"
      : file.endsWith("cambodia.jsonl")
        ? "cambodia"
        : file.endsWith("international.jsonl")
          ? "international"
          : null;
    if (country) news[country].push(...await readJsonl(file));
  }
  return assessContentQuality({ news, analyses });
}
