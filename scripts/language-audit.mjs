import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

const execFileAsync = promisify(execFile);
const convexCli = resolve(process.cwd(), "node_modules", "convex", "bin", "main.js");
const asJson = process.argv.includes("--json");
const sampleLimit = 12;

const THAI_RE = /[\u0E00-\u0E7F]/u;
const KHMER_RE = /[\u1780-\u17FF]/u;
const REPLACEMENT_RE = /\uFFFD/u;
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;
const MOJIBAKE_RE = /(?:\u00C3.|\u00C2.|\u00E2[\u0080-\u00BF]|\u00F0\u0178|\u00EF\u00BB\u00BF|\uFFFD)/u;

async function runConvex(functionName, args = {}) {
  const { stdout } = await execFileAsync(
    process.execPath,
    [convexCli, "run", functionName, JSON.stringify(args)],
    { cwd: process.cwd(), encoding: "utf8", timeout: 45_000, maxBuffer: 16_000_000 },
  );
  return JSON.parse(stdout.trim());
}

function textIssues(value, expectedLanguage) {
  if (typeof value !== "string" || !value.trim()) return ["missing"];
  const issues = [];
  if (REPLACEMENT_RE.test(value)) issues.push("replacement-character");
  if (CONTROL_RE.test(value)) issues.push("control-character");
  if (MOJIBAKE_RE.test(value)) issues.push("likely-mojibake");

  if (expectedLanguage === "th") {
    if (KHMER_RE.test(value)) issues.push("khmer-script-in-thai");
    if (!THAI_RE.test(value)) issues.push("no-thai-script");
  } else if (expectedLanguage === "kh") {
    if (THAI_RE.test(value)) issues.push("thai-script-in-khmer");
    if (!KHMER_RE.test(value)) issues.push("no-khmer-script");
  } else if (expectedLanguage === "en") {
    if (THAI_RE.test(value)) issues.push("thai-script-in-english");
    if (KHMER_RE.test(value)) issues.push("khmer-script-in-english");
  }
  return issues;
}

function styleIssues(value, expectedLanguage, englishSource = "") {
  if (typeof value !== "string" || !value.trim()) return [];
  const issues = [];
  const english = typeof englishSource === "string" ? englishSource : "";
  const englishFirstPerson = /\b(?:we|our|ours|us)\b/i.test(english);

  if (expectedLanguage === "th") {
    if (!englishFirstPerson && /(?:\u0E40\u0E23\u0E32|\u0E1E\u0E35\u0E48\u0E19\u0E49\u0E2D\u0E07|\u0E1E\u0E35\u0E48\u0E44\u0E17\u0E22)/u.test(value)) {
      issues.push("side-taking-tone");
    }
    if (/(?:\u0E19\u0E30\u0E08\u0E4A\u0E30|\u0E08\u0E4A\u0E30|\u0E0B\u0E30\u0E07\u0E31\u0E49\u0E19|\u0E40\u0E09\u0E22\u0E46|\u0E42\u0E27\u0E22|\u0E2A\u0E27\u0E19\u0E01\u0E25\u0E31\u0E1A|\u0E40\u0E1A\u0E35\u0E49\u0E22\u0E27\u0E19\u0E31\u0E14|\u0E14\u0E48\u0E32\u0E01\u0E23\u0E32\u0E14|\u0E2E\u0E38\u0E1A|\u0E08\u0E31\u0E14\u0E2B\u0E19\u0E31\u0E01|\u0E41\u0E09)/u.test(value)) {
      issues.push("chatty-or-loaded-tone");
    }
    if (/\u0E40\u0E02\u0E21\u0E23(?!\u0E41\u0E14\u0E07)/u.test(value)
      && /\bCambodia(?:n)?\b/i.test(english)
      && !/\bKhmer\b/i.test(english)) {
      issues.push("non-neutral-country-label");
    }
  } else if (expectedLanguage === "kh") {
    if (!englishFirstPerson && /(?:\u1799\u17BE\u1784|\u1794\u1784\u1794\u17D2\u17A2\u17BC\u1793)/u.test(value)) {
      issues.push("side-taking-tone");
    }
    if (/\u1796\u17BD\u1780\u1790\u17C3/u.test(value)) issues.push("chatty-or-loaded-tone");
    if (/\u179F\u17C0\u1798(?!\u179A\u17B6\u1794)/u.test(value)
      && /\b(?:Thailand|Thai)\b/i.test(english)
      && !/\bSiam\b/i.test(english)) {
      issues.push("non-neutral-country-label");
    }
  }
  return issues;
}

function addFinding(findings, scope, id, field, value, expectedLanguage) {
  for (const issue of textIssues(value, expectedLanguage)) {
    findings.push({ scope, id, field, issue, value });
  }
}

function summarize(findings) {
  const counts = {};
  for (const finding of findings) counts[finding.issue] = (counts[finding.issue] || 0) + 1;
  return counts;
}

function summarizeFields(findings) {
  const counts = {};
  for (const finding of findings) {
    const key = `${finding.field}:${finding.issue}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function affectedRecords(findings) {
  return new Set(findings.map((finding) => `${finding.scope}|${finding.id}`)).size;
}

function affectedFields(findings) {
  return new Set(findings.map((finding) => `${finding.scope}|${finding.id}|${finding.field}`)).size;
}

function wrongScriptChars(value, issue) {
  if (typeof value !== "string") return [];
  const matcher = issue === "thai-script-in-khmer"
    ? /[\u0E00-\u0E7F]/gu
    : issue === "khmer-script-in-thai"
      ? /[\u1780-\u17FF]/gu
      : null;
  if (!matcher) return [];
  return [...new Set(value.match(matcher) || [])].map((char) => ({
    char,
    codePoint: `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`,
  }));
}

function compactSamples(findings) {
  return findings.slice(0, sampleLimit).map(({ scope, id, field, issue, value }) => ({
    scope,
    id,
    field,
    issue,
    wrongScriptChars: wrongScriptChars(value, issue),
    value: typeof value === "string" && value.length > 220 ? `${value.slice(0, 217)}...` : value,
  }));
}

const [timeline, cambodiaAnalysis, thailandAnalysis, neutralAnalysis, cambodiaNews, thailandNews] = await Promise.all([
  runConvex("api:getTimeline", { limit: 1000 }),
  runConvex("api:getAnalysis", { target: "cambodia" }),
  runConvex("api:getAnalysis", { target: "thailand" }),
  runConvex("api:getAnalysis", { target: "neutral" }),
  runConvex("api:getNews", { country: "cambodia", limit: 100 }),
  runConvex("api:getNews", { country: "thailand", limit: 100 }),
]);

const findings = [];
const styleFindings = [];
const timelineIssueDates = {};
for (const event of timeline) {
  const id = `${event.date} ${event.timeOfDay || ""} ${event.title}`.trim();
  const before = findings.length;
  addFinding(findings, "timeline", id, "title", event.title, "en");
  addFinding(findings, "timeline", id, "titleTh", event.titleTh, "th");
  addFinding(findings, "timeline", id, "titleKh", event.titleKh, "kh");
  addFinding(findings, "timeline", id, "description", event.description, "en");
  addFinding(findings, "timeline", id, "descriptionTh", event.descriptionTh, "th");
  addFinding(findings, "timeline", id, "descriptionKh", event.descriptionKh, "kh");
  for (const [field, language, englishSource] of [
    ["titleTh", "th", event.title], ["titleKh", "kh", event.title],
    ["descriptionTh", "th", event.description], ["descriptionKh", "kh", event.description],
  ]) {
    for (const issue of styleIssues(event[field], language, englishSource)) {
      styleFindings.push({ scope: "timeline", id, field, issue, value: event[field] });
    }
  }
  const added = findings.length - before;
  if (added > 0) {
    const createdDate = event.createdAt
      ? new Date(event.createdAt).toISOString().slice(0, 10)
      : "unknown";
    timelineIssueDates[createdDate] = (timelineIssueDates[createdDate] || 0) + added;
  }
}

for (const [target, analysis] of [
  ["cambodia", cambodiaAnalysis],
  ["thailand", thailandAnalysis],
]) {
  if (!analysis) continue;
  const fields = [
    ["officialNarrative", "en"], ["officialNarrativeTh", "th"], ["officialNarrativeKh", "kh"],
    ["postureLabel", "en"], ["postureLabelTh", "th"], ["postureLabelKh", "kh"],
    ["postureRationale", "en"], ["postureRationaleTh", "th"], ["postureRationaleKh", "kh"],
  ];
  for (const [field, language] of fields) {
    addFinding(findings, `analysis:${target}`, target, field, analysis[field], language);
  }
}

if (neutralAnalysis) {
  for (const [field, language] of [
    ["generalSummary", "en"], ["generalSummaryTh", "th"], ["generalSummaryKh", "kh"],
  ]) {
    addFinding(findings, "analysis:neutral", "neutral", field, neutralAnalysis[field], language);
  }
  const arrays = [
    ["keyEvents", "en"], ["keyEventsTh", "th"], ["keyEventsKh", "kh"],
  ];
  for (const [field, language] of arrays) {
    const values = neutralAnalysis[field];
    if (!Array.isArray(values)) {
      findings.push({ scope: "analysis:neutral", id: "neutral", field, issue: "missing-array", value: values });
      continue;
    }
    values.forEach((value, index) => addFinding(findings, "analysis:neutral", `neutral[${index}]`, field, value, language));
  }
  const lengths = [neutralAnalysis.keyEvents, neutralAnalysis.keyEventsTh, neutralAnalysis.keyEventsKh]
    .map((value) => Array.isArray(value) ? value.length : -1);
  if (new Set(lengths).size !== 1) {
    findings.push({ scope: "analysis:neutral", id: "neutral", field: "keyEvents", issue: "translation-array-length-mismatch", value: lengths.join("/") });
  }
}

const sourceFindings = [];
for (const [country, articles] of [["cambodia", cambodiaNews], ["thailand", thailandNews]]) {
  for (const article of articles) {
    const id = `${country}:${article.source || "unknown"}:${article.title}`;
    for (const field of ["title", "summary", "titleEn", "summaryEn"]) {
      const value = article[field];
      if (typeof value !== "string" || !value.trim()) continue;
      if (REPLACEMENT_RE.test(value)) sourceFindings.push({ scope: "news", id, field, issue: "replacement-character", value });
      if (CONTROL_RE.test(value)) sourceFindings.push({ scope: "news", id, field, issue: "control-character", value });
      if (MOJIBAKE_RE.test(value)) sourceFindings.push({ scope: "news", id, field, issue: "likely-mojibake", value });
    }
    for (const [field, language] of [["titleTh", "th"], ["summaryTh", "th"], ["titleKh", "kh"], ["summaryKh", "kh"]]) {
      const value = article[field];
      if (value === undefined || value === null || value === "") continue;
      for (const issue of textIssues(value, language)) {
        sourceFindings.push({ scope: "news", id, field, issue, value });
      }
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  scanned: {
    timelineEvents: timeline.length,
    analyses: [cambodiaAnalysis, thailandAnalysis, neutralAnalysis].filter(Boolean).length,
    visibleNews: cambodiaNews.length + thailandNews.length,
  },
  generatedText: {
    findingCount: findings.length,
    uniqueFieldCount: affectedFields(findings),
    affectedRecords: affectedRecords(findings),
    counts: summarize(findings),
    byField: summarizeFields(findings),
    timelineIssueDates,
    samples: compactSamples(findings),
  },
  generatedStyle: {
    findingCount: styleFindings.length,
    uniqueFieldCount: affectedFields(styleFindings),
    affectedRecords: affectedRecords(styleFindings),
    counts: summarize(styleFindings),
    byField: summarizeFields(styleFindings),
    samples: compactSamples(styleFindings),
  },
  sourceText: {
    findingCount: sourceFindings.length,
    uniqueFieldCount: affectedFields(sourceFindings),
    affectedRecords: affectedRecords(sourceFindings),
    counts: summarize(sourceFindings),
    byField: summarizeFields(sourceFindings),
    samples: compactSamples(sourceFindings),
  },
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`language-audit timeline=${report.scanned.timelineEvents} analyses=${report.scanned.analyses} visibleNews=${report.scanned.visibleNews}`);
  console.log(`generated findings=${report.generatedText.findingCount} ${JSON.stringify(report.generatedText.counts)}`);
  for (const sample of report.generatedText.samples) {
    console.log(`generated ${sample.issue}: ${sample.scope}.${sample.field} | ${sample.id}`);
    console.log(`  ${sample.value}`);
  }
  console.log(`style findings=${report.generatedStyle.findingCount} ${JSON.stringify(report.generatedStyle.counts)}`);
  for (const sample of report.generatedStyle.samples) {
    console.log(`style ${sample.issue}: ${sample.scope}.${sample.field} | ${sample.id}`);
    console.log(`  ${sample.value}`);
  }
  console.log(`source findings=${report.sourceText.findingCount} ${JSON.stringify(report.sourceText.counts)}`);
  for (const sample of report.sourceText.samples) {
    console.log(`source ${sample.issue}: ${sample.field} | ${sample.id}`);
    console.log(`  ${sample.value}`);
  }
}

process.exitCode = findings.length > 0 || sourceFindings.length > 0 ? 1 : 0;
