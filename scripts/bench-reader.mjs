import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, open, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(".");
const work = resolve(root, ".work", "benchmarks", "reader-copy");
const fixture = await readFile(resolve(root, "benchmarks", "reader-copy.txt"), "utf8");
const agy = process.env.AGY_PATH || "agy";
const model = process.env.BENCH_MODEL || "gemini-3.8-flash-low";
const judgeModel = process.env.BENCH_JUDGE || "gpt-oss-120b-medium";
const printTimeout = process.env.BENCH_TIMEOUT || "90s";
const wallTimeoutMs = Math.max(10_000, Number(process.env.BENCH_WALL_TIMEOUT_MS || 100_000));
const fresh = process.argv.includes("--fresh");
const itemCount = [...fixture.matchAll(/^\d+\.\s/gmu)].length;
const prompt = process.env.BENCH_PROMPT || "Rewrite each item for ordinary civilians in English, Thai, and Khmer. Write naturally for each audience rather than translating literally. Change expression, never information: preserve facts, attribution, uncertainty, names, numbers, and relationships. Add nothing.";

await mkdir(work, { recursive: true });

// A duplicate invocation costs two AI calls and can compete with the first.
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
      // A blank PID may be a different process still writing its lock.
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

function runAgy(runModel, runPrompt) {
  return new Promise((done) => {
    const started = performance.now();
    let settled = false;
    let timedOut = false;
    const child = spawn(agy, [
      "-p", runPrompt,
      "--output-format", "json",
      "--model", runModel,
      "--print-timeout", printTimeout,
      "--disable-slash-commands",
    ], { cwd: work, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });

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
        if (envelope.status !== "SUCCESS") return finish({ ok: false, error: `status=${envelope.status}`, seconds });
        finish({ ok: true, response: String(envelope.response || ""), usage: envelope.usage || null, seconds });
      } catch (error) {
        finish({ ok: false, error: `invalid-json: ${error}`, seconds });
      }
    });
  });
}

async function runCached(runModel, runPrompt) {
  const key = createHash("sha256").update(JSON.stringify({ runModel, runPrompt })).digest("hex");
  const path = resolve(work, "cache", `${key}.json`);
  let cached = null;
  try { cached = JSON.parse(await readFile(path, "utf8")); } catch {}
  if (!fresh) {
    if (cached?.ok) return { ...cached, cached: true };
  }
  const run = await runAgy(runModel, runPrompt);
  await mkdir(resolve(work, "cache"), { recursive: true });
  if (run.ok || !cached?.ok) await writeFile(path, JSON.stringify(run, null, 2) + "\n", "utf8");
  return { ...run, cached: false };
}

function parseItems(response) {
  const items = new Map();
  let current = null;
  let pending = null;

  for (const raw of String(response || "").split(/\r?\n/u)) {
    const line = raw.trim().replace(/\*\*/gu, "").replace(/^[-*+]\s+/u, "");
    if (!line) continue;

    const heading = line.match(/^(?:#{1,6}\s*)?(?:Item\s+)?(\d+)(?:\s*[:.\-–—].*)?$/iu);
    if (heading) {
      current = Number(heading[1]);
      pending = null;
      if (!items.has(current)) items.set(current, {});
      continue;
    }

    const language = line.match(/^(EN|TH|KH):\s*(.*)$/u);
    if (!language) {
      if (pending) {
        items.get(pending.number)[pending.language] = line;
        pending = null;
      }
      continue;
    }

    if (!current) {
      current = items.size + 1;
      if (!items.has(current)) items.set(current, {});
    }
    if (language[2]) items.get(current)[language[1]] = language[2];
    else pending = { number: current, language: language[1] };
  }
  return items;
}

function hardIssues(response) {
  const issues = [];
  const text = String(response || "");
  if (text.includes("\uFFFD")) issues.push("replacement-character");
  const items = parseItems(text);
  if (items.size !== itemCount) issues.push(`item-count-${items.size}`);

  for (let number = 1; number <= itemCount; number += 1) {
    const item = items.get(number) || {};
    for (const language of ["EN", "TH", "KH"]) {
      if (!item[language]) issues.push(`item-${number}-missing-${language.toLowerCase()}`);
      if (item[language] && !item[language].includes("Chouk Chey")) issues.push(`item-${number}-${language.toLowerCase()}-lost-place-name`);
      if (item[language] && !item[language].includes("8,000")) issues.push(`item-${number}-${language.toLowerCase()}-number-changed`);
    }
    if (item.EN && /[\u0E00-\u0E7F\u1780-\u17FF]/u.test(item.EN)) issues.push(`item-${number}-english-mixed-script`);
    if (item.TH && /[\u1780-\u17FF]/u.test(item.TH)) issues.push(`item-${number}-thai-contains-khmer`);
    if (item.KH && /[\u0E00-\u0E7F]/u.test(item.KH)) issues.push(`item-${number}-khmer-contains-thai`);
    if (item.TH && /[\u0E50-\u0E59]/u.test(item.TH)) issues.push(`item-${number}-thai-native-digits`);
    if (item.KH && /[\u17E0-\u17E9]/u.test(item.KH)) issues.push(`item-${number}-khmer-native-digits`);
  }
  return [...new Set(issues)];
}

function extractJson(value) {
  const text = String(value || "").replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("judge did not return JSON");
  return JSON.parse(text.slice(start, end + 1));
}

function validScore(score) {
  return score && typeof score.fatal === "boolean" && Array.isArray(score.issues)
    && ["fidelity", "neutrality", "naturalness"]
      .every((name) => typeof score[name] === "number" && score[name] >= 0 && score[name] <= 10);
}

const lock = await acquireLock();
try {
  const candidatePrompt = `${prompt}\n\nReturn the ${itemCount} numbered items. For each item provide EN:, TH:, and KH:.\n\nSOURCE ITEMS:\n${fixture}`;
  const candidate = await runCached(model, candidatePrompt);
  const hard = candidate.ok ? hardIssues(candidate.response) : ["run-failed"];

  let judgment = null;
  if (candidate.ok && hard.length === 0) {
    const judgePrompt = `Compare the rewrite with the source. Mark fatal=true for any changed fact, attribution, uncertainty, name, number, relationship, claim strength, added implication, or mistranslation. Score 0-10 for factual fidelity, neutrality, and natural everyday English/Thai/Khmer. Return JSON only: {"fidelity":0,"neutrality":0,"naturalness":0,"fatal":false,"issues":[]}\n\nSOURCE:\n${fixture}\n\nREWRITE:\n${candidate.response}`;
    const judge = await runCached(judgeModel, judgePrompt);
    if (judge.ok) {
      try {
        const score = extractJson(judge.response);
        if (!validScore(score)) throw new Error("invalid judge score");
        judgment = { ok: true, seconds: judge.seconds, cached: judge.cached, score };
      } catch (error) {
        judgment = { ok: false, seconds: judge.seconds, error: String(error) };
      }
    } else {
      judgment = judge;
    }
  }

  const hash = createHash("sha256").update(JSON.stringify({ fixture, prompt, model, judgeModel })).digest("hex").slice(0, 12);
  const report = {
    model,
    judgeModel,
    prompt,
    candidate: {
      ok: candidate.ok,
      seconds: candidate.seconds,
      cached: candidate.cached,
      tokens: Number(candidate.usage?.total_tokens || 0),
      error: candidate.error || null,
      response: candidate.response || null,
    },
    hardIssues: hard,
    judgment,
  };

  const score = judgment?.score;
  const passed = candidate.ok
    && hard.length === 0
    && judgment?.ok
    && score?.fatal === false
    && Number(score?.fidelity) >= 8
    && Number(score?.neutrality) >= 8;
  const reportPath = resolve(work, `${hash}${passed ? "" : ".failed"}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log(JSON.stringify({
    ok: passed,
    model,
    judgeModel,
    candidateSeconds: candidate.seconds,
    candidateTokens: Number(candidate.usage?.total_tokens || 0),
    hardIssues: hard,
    judgeSeconds: judgment?.seconds || null,
    score: score || null,
    report: reportPath,
  }, null, 2));

  if (!passed) process.exitCode = 1;
} finally {
  await lock.close();
  await unlink(lockPath);
}
