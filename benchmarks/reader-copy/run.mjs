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

const model = process.env.BENCH_MODEL || "gemini-4-hydrogen-medium";
const judgeModel = process.env.BENCH_JUDGE || "gemini-4-hydrogen-medium";
const printTimeout = process.env.BENCH_TIMEOUT || "150s";
const wallTimeoutMs = Math.max(30_000, Number(process.env.BENCH_WALL_TIMEOUT_MS || 180_000));
const fresh = process.argv.includes("--fresh");
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

const reviewSchema = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["clean", "revise", "fatal"] },
    fidelityProblems: { type: "array", items: { type: "string" } },
    readerProblems: { type: "array", items: { type: "string" } },
    languageProblems: {
      type: "object",
      properties: {
        en: { type: "array", items: { type: "string" } },
        th: { type: "array", items: { type: "string" } },
        kh: { type: "array", items: { type: "string" } },
      },
      required: ["en", "th", "kh"],
      additionalProperties: false,
    },
  },
  required: ["verdict", "fidelityProblems", "readerProblems", "languageProblems"],
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

function validReview(value) {
  return value
    && ["clean", "revise", "fatal"].includes(value.verdict)
    && Array.isArray(value.fidelityProblems)
    && Array.isArray(value.readerProblems)
    && value.languageProblems
    && ["en", "th", "kh"].every((language) => Array.isArray(value.languageProblems[language]));
}

function metrics(candidate) {
  const items = Array.isArray(candidate?.items) ? candidate.items : [];
  return Object.fromEntries(["en", "th", "kh"].map((language) => {
    const values = items.map((item) => String(item?.[language] || ""));
    const chars = values.reduce((sum, value) => sum + value.length, 0);
    const words = language === "en"
      ? values.reduce((sum, value) => sum + (value.match(/\b[\w’'-]+\b/gu) || []).length, 0)
      : null;
    return [language, { chars, words }];
  }));
}

const lock = await acquireLock();
try {
  const candidatePrompt = `This is a closed-book BorderClash reader-copy evaluation. Use only the source items below; do not browse, inspect files, or add outside facts. The canonical guide is the editorial contract for this task.\n\n<CANONICAL_GUIDE>\n${prompt}\n</CANONICAL_GUIDE>\n\nRewrite every source item for ordinary English, Thai, and Khmer readers. Return only the schema-required object.\n\n<SOURCE_ITEMS>\n${JSON.stringify(fixture)}\n</SOURCE_ITEMS>`;
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
  const parsedCandidate = candidate.ok ? candidate.structured : null;
  const hard = candidate.ok ? hardIssues(parsedCandidate) : ["run-failed", candidate.error].filter(Boolean);

  let judgment = null;
  if (candidate.ok && parsedCandidate) {
    const judgePrompt = `This is a blind review of public-facing crisis copy. You are not told which model or prompt produced it. Use only the source and rewrite below; do not browse, inspect files, or infer generator identity.\n\nThe audience is ordinary civilians. Decide whether you would publish the rewrite unchanged, revise it, or reject it for a fatal factual problem. Do not assign numeric scores.\n\nA fatal problem materially changes or invents a fact, number, name, actor, attribution, uncertainty, relationship, status, claim strength, direction, or implication. Nonfatal problems include avoidable ambiguity, verification-memo prose, unnecessary reading burden, unnatural English/Thai/Khmer, or translationese. Judge each language against the source, not against another translation. Report only concrete problems.\n\n<SOURCE>\n${JSON.stringify(fixture)}\n</SOURCE>\n\n<REWRITE>\n${JSON.stringify(parsedCandidate)}\n</REWRITE>`;
    const judge = await runCachedAgyJson({
      cacheRoot: resolve(work, "cache"),
      fresh,
      cwd: runDir,
      model: judgeModel,
      prompt: judgePrompt,
      schema: reviewSchema,
      printTimeout,
      wallTimeoutMs,
    });
    if (judge.ok) {
      judgment = validReview(judge.structured)
        ? { ok: true, seconds: judge.seconds, cached: judge.cached, review: judge.structured }
        : { ok: false, seconds: judge.seconds, error: "invalid judge review" };
    } else {
      judgment = judge;
    }
  }

  const publishableAsIs = candidate.ok
    && hard.length === 0
    && judgment?.ok
    && judgment.review.verdict === "clean";
  const hash = createHash("sha256")
    .update(JSON.stringify({ fixture, prompt, model, judgeModel }))
    .digest("hex")
    .slice(0, 12);
  const report = {
    model,
    judgeModel,
    prompt,
    candidate: {
      ok: candidate.ok,
      seconds: Number(candidate.seconds || 0),
      cached: candidate.cached,
      tokens: Number(candidate.usage?.total_tokens || 0),
      error: candidate.ok ? null : candidate.error,
      response: parsedCandidate,
      metrics: parsedCandidate ? metrics(parsedCandidate) : null,
    },
    hardIssues: hard,
    judgment,
  };
  const reportPath = resolve(work, `${hash}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log(JSON.stringify({
    ok: candidate.ok && judgment?.ok,
    publishableAsIs,
    model,
    judgeModel,
    candidateSeconds: Number(candidate.seconds || 0),
    candidateTokens: Number(candidate.usage?.total_tokens || 0),
    metrics: parsedCandidate ? metrics(parsedCandidate) : null,
    hardIssues: hard,
    review: judgment?.review || null,
    judgeSeconds: judgment?.seconds || null,
    report: reportPath,
  }, null, 2));

  if (!candidate.ok || !judgment?.ok) process.exitCode = 1;
} finally {
  await lock.close();
  await unlink(lockPath).catch(() => {});
}
