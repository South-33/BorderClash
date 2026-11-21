import { createHash } from "node:crypto";
import { mkdir, open, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { runCachedAgyJson } from "../lib/agy-json.mjs";

const root = resolve(".");
const work = resolve(root, ".work", "benchmarks", "reader-copy");
const runDir = resolve(tmpdir(), "borderclash-reader-bench");
const fixture = JSON.parse((await readFile(resolve(root, "benchmarks", "reader-copy", "cases.json"), "utf8")).replace(/^\uFEFF/u, ""));
const canonicalGuide = (await readFile(resolve(root, "research", "CYCLE_GUIDE.md"), "utf8")).trim();

const model = process.env.BENCH_MODEL || "gemini-3.8-flash-medium";
const judgeModel = process.env.BENCH_JUDGE || "gemini-3.8-flash-medium";
const printTimeout = process.env.BENCH_TIMEOUT || "150s";
const wallTimeoutMs = Math.max(30_000, Number(process.env.BENCH_WALL_TIMEOUT_MS || 180_000));
const fresh = process.argv.includes("--fresh");
const repair = process.argv.includes("--repair");
const prompt = process.env.BENCH_PROMPT || canonicalGuide;

const candidateSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      minItems: fixture.length,
      maxItems: fixture.length,
      items: {
        type: "object",
        properties: {
          id: { type: "string", enum: fixture.map((item) => item.id) },
          en: { type: "string", minLength: 1 },
          th: { type: "string", minLength: 1 },
          kh: { type: "string", minLength: 1 },
        },
        required: ["id", "en", "th", "kh"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

const judgeSchema = {
  type: "object",
  properties: {
    fidelity: { type: "number", minimum: 0, maximum: 10 },
    neutrality: { type: "number", minimum: 0, maximum: 10 },
    scanClarity: { type: "number", minimum: 0, maximum: 10 },
    naturalness: {
      type: "object",
      properties: {
        en: { type: "number", minimum: 0, maximum: 10 },
        th: { type: "number", minimum: 0, maximum: 10 },
        kh: { type: "number", minimum: 0, maximum: 10 },
      },
      required: ["en", "th", "kh"],
      additionalProperties: false,
    },
    translationese: {
      type: "object",
      properties: {
        en: { type: "boolean" },
        th: { type: "boolean" },
        kh: { type: "boolean" },
      },
      required: ["en", "th", "kh"],
      additionalProperties: false,
    },
    fatal: { type: "boolean" },
    issues: { type: "array", items: { type: "string" } },
  },
  required: ["fidelity", "neutrality", "scanClarity", "naturalness", "translationese", "fatal", "issues"],
  additionalProperties: false,
};

await mkdir(work, { recursive: true });
await mkdir(runDir, { recursive: true });

const lockPath = resolve(work, ".lock");
async function acquireLock() {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(String(process.pid));
      return handle;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const owner = Number((await readFile(lockPath, "utf8").catch(() => "")).trim());
      if (!Number.isSafeInteger(owner) || owner <= 0) throw new Error("Reader benchmark lock is in use");
      try {
        process.kill(owner, 0);
        throw new Error(`Reader benchmark already running (pid ${owner})`);
      } catch (checkError) {
        if (checkError?.code !== "ESRCH") throw checkError;
      }
      await unlink(lockPath).catch(() => {});
    }
  }
  throw new Error("Could not acquire reader benchmark lock");
}

function itemIssues(source, item) {
  const issues = [];
  if (!item || item.id !== source.id) return [`${source.id}:missing`];

  for (const language of ["en", "th", "kh"]) {
    const value = typeof item[language] === "string" ? item[language].trim() : "";
    if (!value) {
      issues.push(`${source.id}:${language}:missing`);
      continue;
    }
    if (value.includes("\uFFFD")) issues.push(`${source.id}:${language}:replacement-character`);
    if (language === "en" && /[\u0E00-\u0E7F\u1780-\u17FF]/u.test(value)) issues.push(`${source.id}:en:mixed-script`);
    if (language === "th" && !/[\u0E00-\u0E7F]/u.test(value)) issues.push(`${source.id}:th:missing-thai-script`);
    if (language === "kh" && !/[\u1780-\u17FF]/u.test(value)) issues.push(`${source.id}:kh:missing-khmer-script`);
    if (language === "th" && /[\u1780-\u17FF]/u.test(value)) issues.push(`${source.id}:th:contains-khmer`);
    if (language === "kh" && /[\u0E00-\u0E7F]/u.test(value)) issues.push(`${source.id}:kh:contains-thai`);
    if (language === "th" && /[\u0E50-\u0E59]/u.test(value)) issues.push(`${source.id}:th:native-digits`);
    if (language === "kh" && /[\u17E0-\u17E9]/u.test(value)) issues.push(`${source.id}:kh:native-digits`);

    for (const literal of source.literalMustKeep || []) {
      if (!value.includes(literal)) issues.push(`${source.id}:${language}:lost-literal-${literal}`);
    }
  }
  return [...new Set(issues)];
}

function hardIssues(candidate) {
  const items = Array.isArray(candidate?.items) ? candidate.items : [];
  const byId = new Map(items.map((item) => [item?.id, item]));
  const issues = [];
  if (items.length !== fixture.length) issues.push(`item-count-${items.length}`);
  for (const source of fixture) issues.push(...itemIssues(source, byId.get(source.id)));
  return [...new Set(issues)];
}

function validScore(score) {
  const validNumber = (value) => typeof value === "number" && value >= 0 && value <= 10;
  return score
    && typeof score.fatal === "boolean"
    && validNumber(score.fidelity)
    && validNumber(score.neutrality)
    && validNumber(score.scanClarity)
    && score.naturalness
    && ["en", "th", "kh"].every((language) => validNumber(score.naturalness[language]))
    && score.translationese
    && ["en", "th", "kh"].every((language) => typeof score.translationese[language] === "boolean")
    && Array.isArray(score.issues);
}

const lock = await acquireLock();
try {
  const candidatePrompt = `This is a closed-book rewrite benchmark. Use only the source items below. Do not browse, research, inspect files, or use tools. Return the requested JSON immediately.

${prompt}

Rewrite every source item for the three reader audiences. Return JSON only:
{"items":[{"id":"...","en":"...","th":"...","kh":"..."}]}

Before returning, silently compare every language directly with the source facts. Check actor/object direction, what happened versus what was only possible or alleged, numbers, negation, and attribution strength. Do not use English as the sole truth source for Thai or Khmer.

SOURCE ITEMS:
${JSON.stringify(fixture)}`;
  const candidate = await runCachedAgyJson({
    cacheRoot: resolve(work, "cache"),
    fresh,
    cwd: runDir,
    model,
    prompt: candidatePrompt,
    schema: candidateSchema,
    printTimeout,
    wallTimeoutMs,
  });
  const initialCandidateOk = candidate.ok;
  const initialCandidate = initialCandidateOk ? candidate.structured : null;
  let repairRun = null;
  let parsedCandidate = initialCandidate;
  if (repair && initialCandidateOk) {
    const repairPrompt = `This is a closed-book fidelity repair. Use only the source items and draft below. Do not browse, inspect files, or add new facts. Return the same JSON shape immediately.

Correct factual or translation drift while preserving concise, natural reader-facing prose. Compare English, Thai, and Khmer independently against the source, not against one another. Preserve actor/object direction, scope, population or legal category, numbers, negation, attribution, uncertainty, outcome versus ability, and claim strength. Do not add intensifiers, narrower weapon/location specificity, motives, or implications. Do not mix Thai and Khmer scripts; use ASCII digits. If a specialist term has no safe ordinary equivalent, retain the original term rather than inventing a different concept. A source-level negative limitation need not be repeated if the draft simply avoids asserting the excluded fact.

SOURCE ITEMS:
${JSON.stringify(fixture)}

DRAFT:
${JSON.stringify(initialCandidate)}`;
    repairRun = await runCachedAgyJson({
      cacheRoot: resolve(work, "cache"),
      fresh,
      cwd: runDir,
      model,
      prompt: repairPrompt,
      schema: candidateSchema,
      printTimeout,
      wallTimeoutMs,
    });
    if (repairRun.ok) parsedCandidate = repairRun.structured;
  }
  const candidateOk = initialCandidateOk && (!repair || repairRun?.ok);
  const hard = candidateOk ? hardIssues(parsedCandidate) : ["run-failed", candidate.error, repairRun?.error].filter(Boolean);
  const candidateSeconds = Number(candidate.seconds || 0) + Number(repairRun?.seconds || 0);
  const candidateTokens = Number(candidate.usage?.total_tokens || 0) + Number(repairRun?.usage?.total_tokens || 0);
  const candidateCached = candidate.cached;

  let judgment = null;
  if (candidateOk && parsedCandidate) {
    const judgePrompt = `This is a closed-book evaluation. Use only the source and rewrite below. Do not browse, research, inspect files, or use tools. Return the requested JSON immediately.

Evaluate public-facing crisis information for ordinary civilians, not translators or policy analysts.

Fatal means a material changed fact, number, name, attribution, uncertainty, relationship, claim strength, actor/object direction, unsupported specificity, or added implication. Do not require a rewrite to repeat a source's negative limitation (for example, "the source does not say X") when the rewrite simply avoids asserting or implying X. Omitting such meta-commentary is acceptable; moving that limitation onto a party, or implying the excluded fact, is not.

Judge each language independently:
- English: clear everyday general-news writing.
- Thai: natural Thai general-news writing for ordinary readers, not English syntax translated word-for-word and not bureaucratic unless necessary.
- Khmer: natural Cambodian Khmer general-news writing for ordinary readers, not English syntax translated word-for-word and not bureaucratic unless necessary.
- Scan clarity: can a normal reader quickly understand what happened, who says it, and what remains uncertain?
- Simple language must never erase attribution or uncertainty.

Be demanding. A 10 means genuinely excellent for ordinary civilians, not merely grammatical.

Return JSON only:
{"fidelity":0,"neutrality":0,"scanClarity":0,"naturalness":{"en":0,"th":0,"kh":0},"translationese":{"en":false,"th":false,"kh":false},"fatal":false,"issues":[]}

SOURCE:
${JSON.stringify(fixture)}

REWRITE:
${JSON.stringify(parsedCandidate)}`;

    const judge = await runCachedAgyJson({
      cacheRoot: resolve(work, "cache"),
      fresh,
      cwd: runDir,
      model: judgeModel,
      prompt: judgePrompt,
      schema: judgeSchema,
      printTimeout,
      wallTimeoutMs,
    });
    if (judge.ok) {
      const score = judge.structured;
      judgment = validScore(score)
        ? { ok: true, seconds: judge.seconds, cached: judge.cached, score }
        : { ok: false, seconds: judge.seconds, error: "invalid judge score" };
    } else {
      judgment = judge;
    }
  }

  const score = judgment?.score;
  const meetsReferenceThresholds = candidateOk
    && hard.length === 0
    && judgment?.ok
    && score?.fatal === false
    && score?.fidelity >= 9
    && score?.neutrality >= 9
    && score?.scanClarity >= 8
    && ["en", "th", "kh"].every((language) => score?.naturalness?.[language] >= 8)
    && ["en", "th", "kh"].every((language) => score?.translationese?.[language] === false);

  const hash = createHash("sha256")
    .update(JSON.stringify({ fixture, prompt, model, judgeModel }))
    .digest("hex")
    .slice(0, 12);
  const report = {
    model,
    judgeModel,
    prompt,
    candidate: {
      ok: candidateOk,
      seconds: candidateSeconds,
      cached: candidateCached,
      tokens: candidateTokens,
      error: candidateOk ? null : hard.join("; "),
      batches: repair ? 2 : 1,
      initialResponse: repair ? initialCandidate : undefined,
      repair: repairRun ? {
        ok: repairRun.ok,
        seconds: repairRun.seconds,
        cached: repairRun.cached,
        tokens: Number(repairRun.usage?.total_tokens || 0),
        error: repairRun.ok ? null : repairRun.error,
      } : null,
      response: parsedCandidate,
    },
    hardIssues: hard,
    judgment,
  };
  const reportPath = resolve(work, `${hash}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log(JSON.stringify({
    ok: candidateOk && judgment?.ok,
    meetsReferenceThresholds,
    model,
    judgeModel,
    candidateSeconds,
    candidateTokens,
    candidateBatches: repair ? 2 : 1,
    hardIssues: hard,
    judgeSeconds: judgment?.seconds || null,
    score: score || null,
    report: reportPath,
  }, null, 2));

  if (!candidateOk || !judgment?.ok) process.exitCode = 1;
} finally {
  await lock.close();
  await unlink(lockPath).catch(() => {});
}
