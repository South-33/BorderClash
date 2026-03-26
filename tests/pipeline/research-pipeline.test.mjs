import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const researchPath = path.join(root, "convex", "research.ts");
const historianPath = path.join(root, "convex", "historian.ts");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing marker: ${startMarker}`);

  const end = endMarker ? source.indexOf(endMarker, start) : source.length;
  assert.notEqual(end, -1, `Missing marker: ${endMarker}`);

  return source.slice(start, end);
}

test("Convex pipeline sources transpile cleanly in isolation", () => {
  for (const file of ["convex/research.ts", "convex/historian.ts"]) {
    const result = spawnSync(
      "node",
      ["--experimental-strip-types", "--check", file],
      {
        cwd: root,
        encoding: "utf8",
      },
    );

    assert.equal(
      result.status,
      0,
      [result.stdout, result.stderr].filter(Boolean).join("\n"),
    );
  }
});

test("research pipeline retries and handoff guards exist on all chained steps", () => {
  const source = read(researchPath);

  assert.match(source, /const ACTION_RETRY_DELAYS_MS = \[5000, 15000\]/);
  assert.match(source, /const STEP_RETRY_DELAYS_MS = \[60_000, 5 \* 60_000\]/);
  assert.match(source, /async function scheduleStepRetry/);
  assert.match(source, /async function scheduleRunAfterWithRetries/);
  assert.match(source, /async function scheduleRunAtWithRetries/);

  const step1 = section(source, "export const runResearchCycle", "export const step2_verification");
  assert.match(step1, /runWithRetries\(\s*"\[STEP 1\] Cambodia curation"/s);
  assert.match(step1, /runWithRetries\(\s*"\[STEP 1\] Thailand curation"/s);
  assert.match(step1, /runWithRetries\(\s*"\[STEP 1\] International curation"/s);
  assert.match(step1, /scheduleStepRetry\(/);
  assert.match(step1, /scheduleRunAfterWithRetries\(ctx, "Step 2"/);

  const step2 = section(source, "export const step2_verification", "export const step3_historian");
  assert.match(step2, /attempt: v\.optional\(v\.number\(\)\)/);
  assert.match(step2, /runWithRetries\(\s*"\[STEP 2\] Source verification"/s);
  assert.match(step2, /scheduleStepRetry\(/);
  assert.match(step2, /scheduleRunAfterWithRetries\(ctx, "Step 3"/);

  const step3 = section(source, "export const step3_historian", "export const step4_synthesis");
  assert.match(step3, /runWithRetries\(\s*`\[STEP 3\] Historian iteration \$\{historianLoops\}`/s);
  assert.match(step3, /scheduleStepRetry\(/);
  assert.match(step3, /scheduleRunAfterWithRetries\(ctx, "Step 4"/);

  const step4 = section(source, "export const step4_synthesis", "export const verifyAllSources");
  assert.match(step4, /runWithRetries\(\s*"\[STEP 4\] Synthesis"/s);
  assert.match(step4, /scheduleStepRetry\(/);
  assert.match(step4, /scheduleRunAtWithRetries\(\s*ctx,\s*"Next runResearchCycle"/s);
});

test("historian action loop isolates item failures instead of aborting the batch", () => {
  const source = read(historianPath);
  const loop = section(
    source,
    "for (const action of historianResult.actions)",
    "// IMPORTANT: Also mark any selected articles that the AI forgot to include in its response",
  );

  assert.match(loop, /try \{\s*switch \(action\.action\)/s);
  assert.match(loop, /returnedTitles\.add\(searchTitle\)/);
  assert.match(loop, /Credibility update failed for/);
  assert.match(loop, /Failed to apply action/);
});

test("source verification batch isolates per-result failures", () => {
  const source = read(researchPath);
  const verify = section(source, "export const verifyAllSources", "export const verifySingleSource");

  assert.match(verify, /for \(const r of result\.results \|\| \[\]\)/);
  assert.match(verify, /try \{\s*switch \(status\)/s);
  assert.match(verify, /catch \(resultError\)/);
  assert.match(verify, /Error processing verification result for/);
});

test("curation prompts and parsers are hardened against prose and bad escapes", () => {
  const research = read(researchPath);
  const aiUtils = read(path.join(root, "convex", "ai_utils.ts"));
  const historian = read(historianPath);

  assert.doesNotMatch(research, /IMPORTANT - LIST ARTICLES BEFORE JSON/);
  assert.match(research, /Return EXACTLY one fenced \\`\\`\\`json code block and NOTHING else/);
  assert.match(research, /Do NOT apologize, explain your reasoning, or ask follow-up questions/);
  assert.match(research, /const unwrapJsonStringEnvelope = \(input: string\): string =>/);
  assert.match(research, /replace\(\/\\\\\(\?=\[!<>&`\]\)\/g, ""\)/);
  assert.match(research, /replace\(\/\\\\\(\?!\["\\\\\/bfnrtu\]\)\/g, "\\\\\\\\"/);
  assert.match(research, /Extracted JSON from fenced code block/);
  assert.match(research, /Extracted JSON from legacy <json> tags/);
  assert.match(aiUtils, /const unwrapJsonStringEnvelope = \(input: string\): string =>/);
  assert.match(aiUtils, /replace\(\/\\\\\(\?=\[!<>&`\]\)\/g, ""\)/);
  assert.match(aiUtils, /replace\(\/\\\\\(\?!\["\\\\\/bfnrtu\]\)\/g, "\\\\\\\\"/);
  assert.match(aiUtils, /fenced ```json blocks first/);
  assert.doesNotMatch(historian, /List each article with your analysis plan FIRST/);
  assert.match(historian, /Return EXACTLY one fenced \\`\\`\\`json code block and NOTHING else/);
});
