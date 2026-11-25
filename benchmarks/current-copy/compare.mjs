import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { runCachedAgyJson } from "../lib/agy-json.mjs";

const root = resolve(".");
const work = resolve(root, ".work", "benchmarks", "current-copy");
const cacheRoot = resolve(work, "cache");
const runDir = resolve(tmpdir(), "borderclash-current-copy-bench");
const model = process.env.BENCH_MODEL || "gemini-4-hydrogen-medium";
const judgeModel = process.env.BENCH_JUDGE || model;
const fresh = process.argv.includes("--fresh");

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const samples = Math.max(1, Math.min(5, Number(argValue("--samples") || 2)));

async function loadJson(path) {
  return JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/u, ""));
}

async function loadJsonlDir(path) {
  const rows = [];
  for (const name of (await readdir(path)).filter((value) => value.endsWith(".jsonl")).sort()) {
    for (const line of (await readFile(resolve(path, name), "utf8")).split(/\r?\n/u)) {
      if (line.trim()) rows.push(JSON.parse(line));
    }
  }
  return rows;
}

function localDate(ms) {
  if (!Number.isFinite(ms)) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Phnom_Penh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function collectCurrentRefs(current) {
  const ids = new Set();
  const add = (values) => {
    for (const id of Array.isArray(values) ? values : []) if (typeof id === "string" && id) ids.add(id);
  };
  add(current.summary.summaryEvidenceIds);
  for (const item of current.summary.keyUpdates || []) add(item?.evidenceIds);
  for (const side of [current.thailand, current.cambodia]) {
    add(side.summaryEvidenceIds);
    add(side.activityEvidenceIds);
    add(side.militaryAssessment?.evidenceIds);
  }
  return ids;
}

async function buildPacket() {
  const current = Object.fromEntries(await Promise.all(
    ["summary", "thailand", "cambodia", "impact"].map(async (name) => [
      name,
      await loadJson(resolve(root, "data", "current", `${name}.json`)),
    ]),
  ));
  const articles = await loadJsonlDir(resolve(root, "data", "news"));
  const timeline = await loadJsonlDir(resolve(root, "data", "timeline"));
  const articleById = new Map(articles.map((row) => [row.id, row]));
  const timelineById = new Map(timeline.map((row) => [row.id, row]));
  const refs = collectCurrentRefs(current);
  const evidenceIds = new Set();
  const timelineIds = new Set();

  const visit = (id) => {
    if (articleById.has(id)) {
      evidenceIds.add(id);
      return;
    }
    const event = timelineById.get(id);
    if (!event || timelineIds.has(id)) return;
    timelineIds.add(id);
    for (const evidenceId of event.evidenceIds || []) visit(evidenceId);
  };
  for (const id of refs) visit(id);

  const newestTimeline = [...timeline]
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.timeOfDay || "").localeCompare(String(a.timeOfDay || "")))
    .slice(0, 5);
  for (const event of newestTimeline) for (const id of event.evidenceIds || []) visit(id);

  return {
    purpose: "Real current BorderClash public-copy evaluation. Existing copy is editable working memory, not authority.",
    currentWorkingCopy: {
      overall: { en: current.summary.summary, th: current.summary.summaryTh, kh: current.summary.summaryKh },
      keyUpdates: (current.summary.keyUpdates || []).map((item) => ({ en: item.text, th: item.textTh, kh: item.textKh })),
      thailand: { en: current.thailand.summary, th: current.thailand.summaryTh, kh: current.thailand.summaryKh },
      cambodia: { en: current.cambodia.summary, th: current.cambodia.summaryTh, kh: current.cambodia.summaryKh },
    },
    structuredCurrentState: {
      impact: current.impact,
      thailand: {
        activityLabel: current.thailand.activityLabel,
        activityDetails: current.thailand.activityDetails,
        militaryAssessment: current.thailand.militaryAssessment,
      },
      cambodia: {
        activityLabel: current.cambodia.activityLabel,
        activityDetails: current.cambodia.activityDetails,
        militaryAssessment: current.cambodia.militaryAssessment,
      },
    },
    evidence: [...evidenceIds].map((id) => {
      const row = articleById.get(id);
      return {
        id,
        source: row.source,
        date: localDate(row.publishedAt || row.fetchedAt),
        credibility: row.credibility,
        title: row.titleEn || row.title,
        summary: row.summary || null,
      };
    }),
    recentTimeline: newestTimeline.map((row) => ({
      id: row.id,
      date: row.date,
      timeOfDay: row.timeOfDay || null,
      title: row.title,
      description: row.description,
      evidenceIds: row.evidenceIds || [],
    })),
  };
}

function guideFromRef(ref) {
  const result = spawnSync("git", ["show", `${ref}:research/CYCLE_GUIDE.md`], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `could not read guide from ${ref}`);
  return result.stdout.trim();
}

async function guideFromFile(path) {
  return (await readFile(resolve(root, path), "utf8")).trim();
}

const localizedSchema = {
  type: "object",
  properties: {
    en: { type: "string", minLength: 1 },
    th: { type: "string", minLength: 1 },
    kh: { type: "string", minLength: 1 },
  },
  required: ["en", "th", "kh"],
  additionalProperties: false,
};

const candidateSchema = {
  type: "object",
  properties: {
    overall: localizedSchema,
    keyUpdates: { type: "array", minItems: 0, maxItems: 6, items: localizedSchema },
    thailand: localizedSchema,
    cambodia: localizedSchema,
  },
  required: ["overall", "keyUpdates", "thailand", "cambodia"],
  additionalProperties: false,
};

const candidateScoreSchema = {
  type: "object",
  properties: {
    fidelity: { type: "number", minimum: 0, maximum: 10 },
    selection: { type: "number", minimum: 0, maximum: 10 },
    roleClarity: { type: "number", minimum: 0, maximum: 10 },
    scanClarity: { type: "number", minimum: 0, maximum: 10 },
    neutrality: { type: "number", minimum: 0, maximum: 10 },
    naturalnessEn: { type: "number", minimum: 0, maximum: 10 },
    naturalnessTh: { type: "number", minimum: 0, maximum: 10 },
    naturalnessKh: { type: "number", minimum: 0, maximum: 10 },
    fatalIssues: { type: "array", items: { type: "string" } },
  },
  required: ["fidelity", "selection", "roleClarity", "scanClarity", "neutrality", "naturalnessEn", "naturalnessTh", "naturalnessKh", "fatalIssues"],
  additionalProperties: false,
};

const scoreSchema = {
  type: "object",
  properties: {
    score: candidateScoreSchema,
    reasons: { type: "array", items: { type: "string" }, maxItems: 8 },
  },
  required: ["score", "reasons"],
  additionalProperties: false,
};

function generatorPrompt(guide, packet, sampleIndex) {
  return `This is a closed-book BorderClash editorial evaluation. Do not browse, use tools, inspect files, or add facts outside the packet. The existing copy is editable working memory, not a required template.\n\n<CANONICAL_GUIDE>\n${guide}\n</CANONICAL_GUIDE>\n\nRewrite only the current public picture: overall synthesis, key updates, Thailand summary, and Cambodia summary. Use the evidence and structured state to decide what deserves public space. Preserve material facts, attribution, uncertainty, and claim strength. Do not invent causal links. English, Thai, and Khmer should each read naturally for ordinary local readers. This is sample ${sampleIndex}; solve the task independently rather than imitating any prior wording. Return only the schema-required object.\n\n<PACKET>\n${JSON.stringify(packet)}\n</PACKET>`;
}

function judgePrompt(packet, candidate) {
  return `This is a closed-book review of one BorderClash current-copy candidate. Use only the packet and candidate. Do not browse or use tools.\n\nThe audience is ordinary civilians. Judge whether the candidate gives a truthful, fair, quickly understandable current picture while leaving lower-value detail in the timeline/evidence layer. Penalize duplication across overall/key updates/country summaries, low-value precision, institutional jargon, verification-memo prose, loaded narrator framing, literal translationese, unsupported causal links, and any loss or strengthening of attribution/uncertainty. Country cards separately display the structured military activity/posture fields supplied in the packet, so do not require those details to be repeated in the prose. A fatal issue is a material factual change, invented fact, dropped claimant on a disputed claim, changed number/date/actor, or materially stronger/weaker certainty. Do not reward a candidate merely for being shorter.\n\nScore the candidate from 0-10.\n\n<PACKET>\n${JSON.stringify(packet)}\n</PACKET>\n\n<CANDIDATE>\n${JSON.stringify(candidate)}\n</CANDIDATE>`;
}

function words(value) {
  return String(value || "").trim().split(/\s+/u).filter(Boolean).length;
}

function metrics(candidate) {
  const text = [candidate.overall, candidate.thailand, candidate.cambodia, ...(candidate.keyUpdates || [])];
  const byLanguage = {};
  for (const language of ["en", "th", "kh"]) {
    const values = text.map((item) => item?.[language] || "");
    byLanguage[language] = {
      chars: values.reduce((sum, value) => sum + value.length, 0),
      words: values.reduce((sum, value) => sum + words(value), 0),
    };
  }
  return {
    keyUpdates: candidate.keyUpdates?.length || 0,
    currentCopy: byLanguage,
  };
}

function objectiveIssues(candidate) {
  const issues = [];
  const values = [candidate.overall, candidate.thailand, candidate.cambodia, ...(candidate.keyUpdates || [])];
  for (const [index, item] of values.entries()) {
    for (const language of ["en", "th", "kh"]) {
      const value = String(item?.[language] || "");
      if (!value.trim()) issues.push(`${index}:${language}:missing`);
      if (value.includes("\uFFFD")) issues.push(`${index}:${language}:replacement-character`);
      if (language === "en" && /[\u0E00-\u0E7F\u1780-\u17FF]/u.test(value)) issues.push(`${index}:en:mixed-script`);
      if (language === "th" && !/[\u0E00-\u0E7F]/u.test(value)) issues.push(`${index}:th:missing-thai-script`);
      if (language === "kh" && !/[\u1780-\u17FF]/u.test(value)) issues.push(`${index}:kh:missing-khmer-script`);
      if (language === "th" && /[\u1780-\u17FF]/u.test(value)) issues.push(`${index}:th:contains-khmer`);
      if (language === "kh" && /[\u0E00-\u0E7F]/u.test(value)) issues.push(`${index}:kh:contains-thai`);
    }
  }
  return [...new Set(issues)];
}

async function runVariant(label, guide) {
  const runs = [];
  for (let index = 1; index <= samples; index += 1) {
    const run = await runCachedAgyJson({
      cacheRoot,
      fresh,
      cwd: runDir,
      model,
      prompt: generatorPrompt(guide, packet, index),
      schema: candidateSchema,
    });
    if (!run.ok) {
      runs.push({ label, sample: index, run, objectiveIssues: ["generation-failed"], judgment: null });
      continue;
    }
    const issues = objectiveIssues(run.structured);
    const judgment = await runCachedAgyJson({
      cacheRoot,
      fresh,
      cwd: runDir,
      model: judgeModel,
      prompt: judgePrompt(packet, run.structured),
      schema: scoreSchema,
    });
    runs.push({ label, sample: index, run, objectiveIssues: issues, judgment, metrics: metrics(run.structured) });
  }
  return runs;
}

function summarize(runs) {
  const scored = runs.filter((item) => item.judgment?.ok);
  const dimensions = ["fidelity", "selection", "roleClarity", "scanClarity", "neutrality", "naturalnessEn", "naturalnessTh", "naturalnessKh"];
  const averages = Object.fromEntries(dimensions.map((key) => [key, scored.length
    ? scored.reduce((sum, item) => sum + Number(item.judgment.structured.score[key] || 0), 0) / scored.length
    : null]));
  return {
    samples: runs.length,
    generationFailures: runs.filter((item) => !item.run.ok).length,
    objectiveIssueSamples: runs.filter((item) => item.objectiveIssues.length > 0).length,
    fatalJudgeSamples: scored.filter((item) => item.judgment.structured.score.fatalIssues.length > 0).length,
    averages,
    metrics: runs.filter((item) => item.metrics).map((item) => item.metrics),
  };
}

await mkdir(work, { recursive: true });
await mkdir(runDir, { recursive: true });
const packet = await buildPacket();
const aRef = argValue("--a-ref") || "HEAD";
const aFile = argValue("--a-file");
const bFile = argValue("--b-file") || "research/CYCLE_GUIDE.md";
const guideA = aFile ? await guideFromFile(aFile) : guideFromRef(aRef);
const guideB = await guideFromFile(bFile);

const [aRuns, bRuns] = await Promise.all([
  runVariant("A", guideA),
  runVariant("B", guideB),
]);
const aSummary = summarize(aRuns);
const bSummary = summarize(bRuns);
const report = {
  generatedAt: new Date().toISOString(),
  model,
  judgeModel,
  samples,
  a: { source: aFile || aRef, summary: aSummary, runs: aRuns },
  b: { source: bFile, summary: bSummary, runs: bRuns },
  packet,
};
const hash = createHash("sha256").update(JSON.stringify({ packet, guideA, guideB, model, judgeModel, samples })).digest("hex").slice(0, 12);
const reportPath = resolve(work, `compare-${hash}.json`);
await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
const allRuns = [...aRuns, ...bRuns];
const ok = allRuns.every((item) => item.run.ok && item.judgment?.ok);
console.log(JSON.stringify({
  ok,
  samples,
  a: aSummary,
  b: bSummary,
  report: reportPath,
}, null, 2));
if (!ok) process.exitCode = 1;
