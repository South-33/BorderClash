import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(".");
const tournament = process.argv.includes("--tournament");
const fixture = await readFile(resolve(root, "benchmarks", "reader-copy.txt"), "utf8");
const variants = JSON.parse(await readFile(resolve(root, "benchmarks", "reader-prompts.json"), "utf8"));
const work = resolve(root, ".work", "benchmarks", "reader-copy");
const agy = process.env.AGY_PATH || "agy";
const timeout = process.env.BENCH_TIMEOUT || "3m";

await rm(work, { recursive: true, force: true });
await mkdir(work, { recursive: true });

const invariants = `Factual fidelity is non-negotiable. Preserve attribution, uncertainty, names, numbers, direction of movement, and the strength of every claim. Do not infer consequences or implications. Keep "reported" caveats. Movement forward does not prove a border crossing. Being displaced does not prove someone cannot return home. A claim by one side must remain attributed to that side. Thai must not contain Khmer script; Khmer must not contain Thai script; use ASCII digits.`;
const format = "Return only the six numbered items. For each item use exactly three lines beginning EN:, TH:, and KH:.";

function runAgy(model, prompt) {
  return new Promise((resolveRun) => {
    const started = performance.now();
    const child = spawn(agy, [
      "-p", prompt,
      "--output-format", "json",
      "--model", model,
      "--print-timeout", timeout,
      "--disable-slash-commands",
    ], { cwd: work, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });

    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => resolveRun({ ok: false, model, error: String(error), seconds: (performance.now() - started) / 1000 }));
    child.on("close", (code) => {
      const seconds = (performance.now() - started) / 1000;
      const out = Buffer.concat(stdout).toString("utf8").replace(/^\uFEFF/u, "");
      const err = Buffer.concat(stderr).toString("utf8");
      if (code !== 0) return resolveRun({ ok: false, model, code, error: err || out, seconds });
      try {
        const envelope = JSON.parse(out);
        if (envelope.status !== "SUCCESS") return resolveRun({ ok: false, model, error: `status=${envelope.status}`, seconds });
        resolveRun({ ok: true, model, response: String(envelope.response || ""), seconds, usage: envelope.usage || null });
      } catch (error) {
        resolveRun({ ok: false, model, error: `invalid-json: ${error}`, seconds, stderr: err });
      }
    });
  });
}

function parsedItems(response) {
  const items = new Map();
  let current = null;
  for (const rawLine of String(response || "").split(/\r?\n/u)) {
    const line = rawLine.trim();
    const number = line.match(/^(\d+)\.\s*$/u);
    if (number) {
      current = Number(number[1]);
      if (!items.has(current)) items.set(current, {});
      continue;
    }
    const language = line.match(/^(EN|TH|KH):\s*(.+)$/u);
    if (current && language) items.get(current)[language[1]] = language[2];
  }
  return items;
}

function hardIssues(response) {
  const issues = [];
  const text = String(response || "");
  if (text.includes("\uFFFD")) issues.push("replacement-character");
  const items = parsedItems(text);

  for (let number = 1; number <= 6; number += 1) {
    const item = items.get(number) || {};
    for (const language of ["EN", "TH", "KH"]) {
      if (!item[language]) issues.push(`item-${number}-missing-${language.toLowerCase()}`);
    }
    if (item.TH && /[\u1780-\u17FF]/u.test(item.TH)) issues.push(`item-${number}-thai-contains-khmer`);
    if (item.KH && /[\u0E00-\u0E7F]/u.test(item.KH)) issues.push(`item-${number}-khmer-contains-thai`);
  }

  const item1 = items.get(1)?.EN || "";
  const item3 = items.get(3)?.EN || "";
  const item4 = items.get(4)?.EN || "";
  if (item1 && !/report/iu.test(item1)) issues.push("item-1-lost-reported-caveat");
  if (/\b(?:cross(?:ed|ing)?|enter(?:ed|ing)?|encroach(?:ed|ing)?|intrud(?:e|ed|ing))\b/iu.test(item3)) issues.push("item-3-inferred-border-crossing");
  if (/\b(?:cannot|can't|unable to)\s+return\b/iu.test(item4)) issues.push("item-4-inferred-return-home");
  if (item4 && !/8,000/u.test(item4)) issues.push("item-4-number-changed");
  return [...new Set(issues)];
}

function promptFor(variant) {
  return `${invariants}\n\n${variant.prompt}\n\n${format}\n\nSOURCE ITEMS:\n${fixture}`;
}

function extractJson(value) {
  const text = String(value || "").replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("judge did not return JSON");
  return JSON.parse(text.slice(start, end + 1));
}

if (!tournament) {
  const variant = variants.find((value) => value.id === "priority") || variants[0];
  const model = process.env.BENCH_MODEL || "gemini-3.8-flash-medium";
  const run = await runAgy(model, promptFor(variant));
  const issues = run.ok ? hardIssues(run.response) : ["run-failed"];
  const report = { mode: "quick", promptId: variant.id, model, ...run, hardIssues: issues };
  await writeFile(resolve(work, "quick.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ ok: run.ok && issues.length === 0, promptId: variant.id, model, seconds: run.seconds, hardIssues: issues }, null, 2));
  if (!run.ok || issues.length) process.exit(1);
  process.exit(0);
}

const candidateModels = (process.env.BENCH_MODELS || "gemini-3.8-flash-medium")
  .split(",").map((value) => value.trim()).filter(Boolean);
const judgeModels = (process.env.BENCH_JUDGES || "gemini-3.8-flash-high")
  .split(",").map((value) => value.trim()).filter(Boolean);
const candidates = [];

// Intentionally sequential. Concurrent AGY runs distorted latency enough to make
// healthy Medium runs hit their print timeout during the first tournament trial.
for (const model of candidateModels) {
  for (const variant of variants) {
    const run = await runAgy(model, promptFor(variant));
    candidates.push({
      id: `${variant.id}__${model}`,
      promptId: variant.id,
      promptChars: variant.prompt.length,
      model,
      ...run,
      hardIssues: run.ok ? hardIssues(run.response) : ["run-failed"],
    });
  }
}

await writeFile(resolve(work, "candidates.json"), JSON.stringify(candidates, null, 2) + "\n", "utf8");
const eligible = candidates.filter((candidate) => candidate.ok && candidate.hardIssues.length === 0);
const candidateText = eligible.map((candidate) => `CANDIDATE id=${candidate.id}\n${candidate.response}`).join("\n\n---\n\n");
const judges = [];

if (eligible.length) {
  const judgePrompt = `You are a strict blind quality reviewer. Evaluate the candidates against the SOURCE ITEMS. Factual fidelity dominates. Mark fatal=true for any added implication, stronger/weaker claim, lost attribution or uncertainty, changed name/number/place, or mistranslation. Neutrality means the same evidence standard, not forced equal blame. Score 0-10 for fidelity, neutrality, clarity, naturalness across English/Thai/Khmer, and concision. Use the exact candidate id shown after "id="; never renumber candidates. Return JSON only: {"scores":[{"id":"exact id","fidelity":0,"neutrality":0,"clarity":0,"naturalness":0,"concision":0,"fatal":false,"issues":[]}]}\n\nSOURCE ITEMS:\n${fixture}\n\nCANDIDATES:\n${candidateText}`;
  for (const model of judgeModels) {
    const run = await runAgy(model, judgePrompt);
    if (!run.ok) {
      judges.push({ model, ok: false, error: run.error, seconds: run.seconds });
      continue;
    }
    try {
      const result = extractJson(run.response);
      const matched = (result.scores || []).filter((score) => eligible.some((candidate) => candidate.id === score.id));
      if (!matched.length) throw new Error("judge returned no exact candidate ids");
      judges.push({ model, ok: true, seconds: run.seconds, result: { scores: matched } });
    } catch (error) {
      judges.push({ model, ok: false, seconds: run.seconds, error: String(error), raw: run.response });
    }
  }
}

await writeFile(resolve(work, "judges.json"), JSON.stringify(judges, null, 2) + "\n", "utf8");
const rows = new Map(eligible.map((candidate) => [candidate.id, {
  id: candidate.id,
  promptId: candidate.promptId,
  model: candidate.model,
  promptChars: candidate.promptChars,
  seconds: candidate.seconds,
  scores: [],
  fatalVotes: 0,
}]));

for (const judge of judges.filter((value) => value.ok)) {
  for (const score of judge.result.scores) {
    const row = rows.get(score.id);
    if (!row) continue;
    row.scores.push(Number(score.fidelity) * 4
      + Number(score.neutrality) * 2
      + Number(score.clarity) * 1.5
      + Number(score.naturalness) * 1.5
      + Number(score.concision));
    if (score.fatal) row.fatalVotes += 1;
  }
}

const rankedCandidates = [...rows.values()].map((row) => ({
  ...row,
  quality: row.scores.length ? row.scores.reduce((sum, value) => sum + value, 0) / row.scores.length : 0,
})).sort((a, b) => (a.fatalVotes - b.fatalVotes) || (b.quality - a.quality) || (a.promptChars - b.promptChars));

const promptResults = variants.map((variant) => {
  const values = rankedCandidates.filter((row) => row.promptId === variant.id && row.fatalVotes === 0 && row.scores.length > 0);
  return {
    promptId: variant.id,
    prompt: variant.prompt,
    promptChars: variant.prompt.length,
    modelsPassed: values.length,
    meanQuality: values.length ? values.reduce((sum, row) => sum + row.quality, 0) / values.length : 0,
    minQuality: values.length ? Math.min(...values.map((row) => row.quality)) : 0,
    meanSeconds: values.length ? values.reduce((sum, row) => sum + row.seconds, 0) / values.length : 0,
  };
}).sort((a, b) => (b.modelsPassed - a.modelsPassed) || (b.minQuality - a.minQuality) || (b.meanQuality - a.meanQuality) || (a.promptChars - b.promptChars));

const winner = promptResults.find((row) => row.modelsPassed > 0) || null;
const report = { mode: "tournament", candidateModels, judgeModels, candidates: rankedCandidates, prompts: promptResults, winner };
await writeFile(resolve(work, "report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify(report, null, 2));
if (!winner) process.exit(1);
