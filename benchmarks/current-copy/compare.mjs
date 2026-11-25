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

const pairwiseSchema = {
  type: "object",
  properties: {
    winner: { type: "string", enum: ["A", "B", "tie"] },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    candidateAProblems: { type: "array", items: { type: "string" } },
    candidateBProblems: { type: "array", items: { type: "string" } },
    reasons: { type: "array", minItems: 1, maxItems: 6, items: { type: "string" } },
    readerDifference: { type: "string" },
  },
  required: ["winner", "confidence", "candidateAProblems", "candidateBProblems", "reasons", "readerDifference"],
  additionalProperties: false,
};

function generatorPrompt(guide, packet) {
  return `This is a closed-book BorderClash editorial evaluation. Use only the packet below; do not browse, inspect files, or add outside facts. The canonical guide is the editorial contract for this task.\n\n<CANONICAL_GUIDE>\n${guide}\n</CANONICAL_GUIDE>\n\nProduce the current public picture: overall synthesis, key updates, Thailand summary, and Cambodia summary, in English, Thai, and Khmer. Return only the schema-required object.\n\n<PACKET>\n${JSON.stringify(packet)}\n</PACKET>`;
}

function pairwisePrompt(packet, candidateA, candidateB) {
  return `This is a blind comparison of two BorderClash public-copy candidates. You are not told which guide or system produced either one. Use only the packet and candidates; do not browse, inspect files, or infer generator identity.\n\ncurrentWorkingCopy is editable working memory, not evidence or authority. Judge factual support from evidence, structuredCurrentState, and recentTimeline; a candidate may correctly repair the working copy.\n\nChoose the candidate that better serves an ordinary civilian trying to understand the current Thailand-Cambodia border situation. Faithfulness to evidence, chronology, status, attribution, and uncertainty comes first. Then prefer useful selection, clear roles between surfaces, natural English/Thai/Khmer, low duplication, and low reading burden. Do not reward verbosity or brevity by itself.\n\nIdentify concrete problems rather than assigning numeric scores. A material problem includes a changed or invented actor, fact, number, date, status, attribution, uncertainty, claim strength, causal link, or misleading omission. A tie is valid when neither candidate is meaningfully better.\n\n<PACKET>\n${JSON.stringify(packet)}\n</PACKET>\n\n<CANDIDATE_A>\n${JSON.stringify(candidateA)}\n</CANDIDATE_A>\n\n<CANDIDATE_B>\n${JSON.stringify(candidateB)}\n</CANDIDATE_B>`;
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
      prompt: generatorPrompt(guide, packet),
      schema: candidateSchema,
      cacheSalt: `sample-${index}`,
    });
    runs.push({
      label,
      sample: index,
      run,
      objectiveIssues: run.ok ? objectiveIssues(run.structured) : ["generation-failed"],
      metrics: run.ok ? metrics(run.structured) : null,
    });
  }
  return runs;
}

function summarizeGeneration(runs) {
  return {
    samples: runs.length,
    generationFailures: runs.filter((item) => !item.run.ok).length,
    objectiveIssueSamples: runs.filter((item) => item.objectiveIssues.length > 0).length,
    metrics: runs.filter((item) => item.metrics).map((item) => item.metrics),
  };
}

function mappedProblems(judgment, order, variant) {
  if (!judgment?.ok) return [];
  const value = judgment.structured;
  if (order.A === variant) return value.candidateAProblems;
  if (order.B === variant) return value.candidateBProblems;
  return [];
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

const comparisons = [];
for (let index = 0; index < samples; index += 1) {
  const aRun = aRuns[index];
  const bRun = bRuns[index];
  if (!aRun?.run.ok || !bRun?.run.ok) {
    comparisons.push({ sample: index + 1, ok: false, error: "generation-failed" });
    continue;
  }

  // Alternate presentation order so a consistent A/B position preference does not
  // systematically favor one guide across a multi-sample comparison.
  const order = index % 2 === 0
    ? { A: "a", B: "b" }
    : { A: "b", B: "a" };
  const candidateA = order.A === "a" ? aRun.run.structured : bRun.run.structured;
  const candidateB = order.B === "b" ? bRun.run.structured : aRun.run.structured;
  const judgment = await runCachedAgyJson({
    cacheRoot,
    fresh,
    cwd: runDir,
    model: judgeModel,
    prompt: pairwisePrompt(packet, candidateA, candidateB),
    schema: pairwiseSchema,
  });
  const blindWinner = judgment.ok ? judgment.structured.winner : null;
  const winner = blindWinner === "tie" || !blindWinner ? blindWinner : order[blindWinner];
  comparisons.push({
    sample: index + 1,
    ok: judgment.ok,
    order,
    winner,
    confidence: judgment.ok ? judgment.structured.confidence : null,
    aProblems: mappedProblems(judgment, order, "a"),
    bProblems: mappedProblems(judgment, order, "b"),
    reasons: judgment.ok ? judgment.structured.reasons : [],
    readerDifference: judgment.ok ? judgment.structured.readerDifference : "",
    judgment,
  });
}

const comparisonSummary = {
  aWins: comparisons.filter((item) => item.winner === "a").length,
  bWins: comparisons.filter((item) => item.winner === "b").length,
  ties: comparisons.filter((item) => item.winner === "tie").length,
  judgeFailures: comparisons.filter((item) => !item.ok).length,
};
const aSummary = summarizeGeneration(aRuns);
const bSummary = summarizeGeneration(bRuns);
const report = {
  generatedAt: new Date().toISOString(),
  model,
  judgeModel,
  samples,
  a: { source: aFile || aRef, summary: aSummary, runs: aRuns },
  b: { source: bFile, summary: bSummary, runs: bRuns },
  comparison: { summary: comparisonSummary, runs: comparisons },
  packet,
};
const hash = createHash("sha256").update(JSON.stringify({ packet, guideA, guideB, model, judgeModel, samples })).digest("hex").slice(0, 12);
const reportPath = resolve(work, `compare-${hash}.json`);
await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
const ok = [...aRuns, ...bRuns].every((item) => item.run.ok) && comparisons.every((item) => item.ok);
console.log(JSON.stringify({
  ok,
  samples,
  a: aSummary,
  b: bSummary,
  comparison: comparisonSummary,
  verdicts: comparisons.map(({ sample, winner, confidence, aProblems, bProblems, reasons, readerDifference }) => ({
    sample, winner, confidence, aProblems, bProblems, reasons, readerDifference,
  })),
  report: reportPath,
}, null, 2));
if (!ok) process.exitCode = 1;
