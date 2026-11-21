import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildCycleReport } from "../research/automation/cycle-history.mjs";

const script = resolve("research/automation/cycle-history.mjs");
const runId = "20261121T095120746Z";

function withFixture(fn) {
  const root = mkdtempSync(join(tmpdir(), "borderclash-cycle-history-"));
  const logs = join(root, "logs");
  const runtime = join(root, "runtime");
  const runDir = join(root, "runs", runId);
  mkdirSync(logs, { recursive: true });
  mkdirSync(runtime, { recursive: true });
  mkdirSync(join(runDir, ".work"), { recursive: true });
  try { fn({ root, logs, runtime, runDir }); } finally { rmSync(root, { recursive: true, force: true }); }
}

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function cli(root, ...args) {
  return spawnSync(process.execPath, [script, ...args, "--runner-root", root], { encoding: "utf8" });
}

test("saved cycle review combines resumed trace, evidence patch, finish, and verified delivery", () => {
  withFixture(({ root, logs, runtime, runDir }) => {
    const first = [
      { event: "init", conversation_id: "fixture" },
      { event: "step_update", step_update: { step_index: 2, state: "DONE", step_type: "tool", tool_name: "search_web", tool_info: { parameters: { query: "border monitoring source" } } } },
      { event: "step_update", step_update: { step_index: 3, state: "DONE", step_type: "tool", tool_name: "run_command", tool_info: { parameters: { CommandLine: "node research/cli.mjs probe-source https://example.org/signed-path?token=private" }, output: "Command exited with code 1.\n" } } },
    ];
    writeFileSync(join(logs, `${runId}.events.ndjson`), first.map((x) => JSON.stringify(x)).join("\n") + "\n");
    writeFileSync(join(logs, `${runId}.resume-1.events.ndjson`), JSON.stringify({
      event: "step_update", step_update: { conversation_id: "fixture-resume", step_index: 4, state: "DONE", step_type: "tool", tool_name: "run_command", tool_info: { parameters: { CommandLine: "node research/cli.mjs finish 12 researched" }, output: "Command exited with code 0.\n" } },
    }) + "\n");
    writeJson(join(logs, `${runId}.resume-1.result.json`), { conversation_id: "fixture-resume", status: "SUCCESS", response: "Review complete" });
    writeFileSync(join(logs, `${runId}.feedback.txt`), "Source probing needed a retry.\n");
    writeJson(join(logs, `${runId}.completion.json`), { cycleId: runId, baseHead: "base123", intervalHours: 12, reason: "Evidence checked" });
    writeJson(join(logs, `${runId}.delivery.json`), { runId, status: "verified", candidateCommit: "candidate123", servedCommit: "candidate123" });
    writeFileSync(join(logs, `${runId}.data.patch`), "diff --git a/data/current/summary.json b/data/current/summary.json\n+++ b/data/current/summary.json\n");
    writeJson(join(runtime, "runtime.json"), { runId, status: "published", runDir });

    const output = cli(root, "save", runId);
    assert.equal(output.status, 0, output.stderr);
    const reportPath = join(root, "history", runId, "report.json");
    assert.ok(existsSync(reportPath));
    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    assert.equal(report.status, "published");
    assert.equal(report.decision, "complete");
    assert.equal(report.nextCadenceHours, 12);
    assert.equal(report.servedCommit, "candidate123");
    assert.deepEqual(report.conversationIds, ["fixture", "fixture-resume"]);
    assert.equal(report.attempts[1].conversationId, "fixture-resume");
    assert.equal(report.attempts[1].resultFile, `${runId}.resume-1.result.json`);
    assert.equal(report.feedbackContext.conversationId, "fixture-resume");
    assert.equal(report.feedbackContext.kind, "agent-harness-feedback");
    assert.deepEqual(report.changedPaths, ["data/current/summary.json"]);
    assert.deepEqual(report.steps.map((x) => x.attempt), [0, 0, 1]);
    assert.equal(report.steps[1].outcome, "exit 1");
    assert.doesNotMatch(JSON.stringify(report), /token=private/u);
    const markdown = readFileSync(join(root, "history", runId, "report.md"), "utf8");
    assert.match(markdown, /Diagnostic context/u);
    assert.match(markdown, /fixture-resume/u);
    assert.match(markdown, /Agent harness feedback: Source probing needed a retry/u);
    assert.match(readFileSync(join(root, "history", "INDEX.md"), "utf8"), new RegExp(`${runId}.*fixture-resume`, "u"));

    rmSync(runDir, { recursive: true, force: true });
    assert.equal(cli(root, "list").status, 0);
    assert.match(cli(root, "list").stdout, /published/u);
    assert.match(cli(root, "show", runId).stdout, /Evidence checked/u);
  });
});

test("review records are usable during an interrupted cycle and can be refreshed later", () => {
  withFixture(({ root, logs, runtime }) => {
    writeJson(join(runtime, "runtime.json"), { runId, status: "running", model: "model-fixture" });
    writeFileSync(join(logs, `${runId}.context.md`), "# Cycle context\n");
    assert.equal(cli(root, "save", runId).status, 0);
    assert.equal(buildCycleReport(runId, { runnerRoot: root }).status, "running");
    writeJson(join(logs, `${runId}.delivery.json`), { status: "verified", candidateCommit: "new", servedCommit: "new" });
    assert.equal(cli(root, "save", runId).status, 0);
    assert.equal(JSON.parse(readFileSync(join(root, "history", runId, "report.json"), "utf8")).status, "published");
    assert.notEqual(cli(root, "show", "../../oops").status, 0);
  });
});
