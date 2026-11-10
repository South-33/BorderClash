import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, open, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const root = resolve(".");
const work = resolve(root, ".work", "benchmarks", "reader-copy");
const runDir = resolve(tmpdir(), "borderclash-reader-bench");
const fixture = JSON.parse((await readFile(resolve(root, "benchmarks", "reader-copy.json"), "utf8")).replace(/^\uFEFF/u, ""));
const agents = await readFile(resolve(root, "AGENTS.md"), "utf8");
const section = agents.match(/## Reader copy\s*\n([\s\S]*?)(?=\n## |$)/u);
if (!section) throw new Error("AGENTS.md is missing the Reader copy section");

const agy = process.env.AGY_PATH || "agy";
const model = process.env.BENCH_MODEL || "gemini-3.8-flash-medium";
const judgeModel = process.env.BENCH_JUDGE || "gpt-oss-120b-medium";
const printTimeout = process.env.BENCH_TIMEOUT || "150s";
const wallTimeoutMs = Math.max(30_000, Number(process.env.BENCH_WALL_TIMEOUT_MS || 180_000));
const fresh = process.argv.includes("--fresh");
const prompt = process.env.BENCH_PROMPT || section[1].trim();

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

function runAgy(runModel, runPrompt, schema) {
  return new Promise((done) => {
    const started = performance.now();
    let settled = false;
    let timedOut = false;
    const child = spawn(agy, [
      "-p", runPrompt,
      "--output-format", "json",
      "--json-schema", JSON.stringify(schema),
      "--model", runModel,
      "--print-timeout", printTimeout,
      "--disable-slash-commands",
    ], { cwd: runDir, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });

    const stdout = [];
    const stderr = [];
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      done(value);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      } else {
        child.kill("SIGKILL");
      }
    }, wallTimeoutMs);
    timer.unref?.();

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => finish({ ok: false, error: String(error), seconds: (performance.now() - started) / 1000 }));
    child.on("close", (code) => {
      const seconds = (performance.now() - started) / 1000;
      const raw = Buffer.concat(stdout).toString("utf8").replace(/^\uFEFF/u, "");
      const err = Buffer.concat(stderr).toString("utf8");
      if (timedOut) return finish({ ok: false, error: `wall-timeout-${wallTimeoutMs}ms`, seconds });
      if (code !== 0) return finish({ ok: false, error: err || raw, seconds });
      try {
        const envelope = JSON.parse(raw);
        if (envelope.status !== "SUCCESS") return finish({ ok: false, error: envelope.error || `status=${envelope.status}`, seconds });
        if (!envelope.structured_output) return finish({ ok: false, error: "missing structured_output", seconds });
        finish({ ok: true, structured: envelope.structured_output, usage: envelope.usage || null, seconds });
      } catch (error) {
        finish({ ok: false, error: `invalid-json: ${error}`, seconds });
      }
    });
  });
}

async function runCached(runModel, runPrompt, schema) {
  const key = createHash("sha256").update(JSON.stringify({ runModel, runPrompt, schema })).digest("hex");
  const path = resolve(work, "cache", `${key}.json`);
  let cached = null;
  try { cached = JSON.parse(await readFile(path, "utf8")); } catch {}
  if (!fresh && cached?.ok) return { ...cached, cached: true };

  const run = await runAgy(runModel, runPrompt, schema);
  await mkdir(resolve(work, "cache"), { recursive: true });
  if (run.ok || !cached?.ok) await writeFile(path, JSON.stringify(run, null, 2) + "\n", "utf8");
  return { ...run, cached: false };
}

function expectedNumbers(source) {
  return [...new Set(String(source).match(/\b\d[\d,]*(?:\.\d+)?\b/gu) || [])];
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

    for (const number of expectedNumbers(source.source)) {
      if (!value.includes(number)) issues.push(`${source.id}:${language}:lost-number-${number}`);
    }
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

SOURCE ITEMS:
${JSON.stringify(fixture)}`;
  const candidate = await runCached(model, candidatePrompt, candidateSchema);
  const candidateOk = candidate.ok;
  const parsedCandidate = candidateOk ? candidate.structured : null;
  const hard = candidateOk ? hardIssues(parsedCandidate) : ["run-failed", candidate.error].filter(Boolean);
  const candidateSeconds = Number(candidate.seconds || 0);
  const candidateTokens = Number(candidate.usage?.total_tokens || 0);
  const candidateCached = candidate.cached;

  let judgment = null;
  if (candidateOk && parsedCandidate && hard.length === 0) {
    const judgePrompt = `This is a closed-book evaluation. Use only the source and rewrite below. Do not browse, research, inspect files, or use tools. Return the requested JSON immediately.

Evaluate public-facing crisis information for ordinary civilians, not translators or policy analysts.

Fatal means any changed fact, number, name, attribution, uncertainty, relationship, claim strength, actor/object direction, or added implication.

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

    const judge = await runCached(judgeModel, judgePrompt, judgeSchema);
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
  const passed = candidateOk
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
      batches: 1,
      response: parsedCandidate,
    },
    hardIssues: hard,
    judgment,
  };
  const reportPath = resolve(work, `${hash}${passed ? "" : ".failed"}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log(JSON.stringify({
    ok: passed,
    model,
    judgeModel,
    candidateSeconds,
    candidateTokens,
    candidateBatches: 1,
    hardIssues: hard,
    judgeSeconds: judgment?.seconds || null,
    score: score || null,
    report: reportPath,
  }, null, 2));

  if (!passed) process.exitCode = 1;
} finally {
  await lock.close();
  await unlink(lockPath).catch(() => {});
}
