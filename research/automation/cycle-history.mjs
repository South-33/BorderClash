#!/usr/bin/env node
// Local, read-only reconstruction of a research cycle plus an optional saved
// review report. Raw traces remain in logs/; neither is committed or published.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRunnerRoot = resolve(fileURLToPath(new URL("../../.work/runner/", import.meta.url)));
const runIdPattern = /^\d{8}T\d{9}Z$/u;

function readJson(path) {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
}

function readText(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function safeRunId(value) {
  if (!runIdPattern.test(String(value || ""))) throw new Error(`Invalid cycle ID: ${value}`);
  return value;
}

function startIso(runId) {
  const match = runId.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{3})Z$/u);
  return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}.${match[7]}Z` : null;
}

function eventFiles(logDir, runId) {
  if (!existsSync(logDir)) return [];
  const expression = new RegExp(`^${runId}(?:\\.resume-(\\d+))?\\.events\\.ndjson$`, "u");
  return readdirSync(logDir).flatMap((name) => {
    const match = name.match(expression);
    return match ? [{ name, attempt: Number(match[1] || 0) }] : [];
  }).sort((a, b) => a.attempt - b.attempt);
}

function resultFiles(logDir, runId) {
  if (!existsSync(logDir)) return [];
  const expression = new RegExp(`^${runId}(?:\\.resume-(\\d+))?\\.result\\.json$`, "u");
  return readdirSync(logDir).flatMap((name) => {
    const match = name.match(expression);
    return match ? [{ name, attempt: Number(match[1] || 0) }] : [];
  }).sort((a, b) => a.attempt - b.attempt);
}

function safeDetail(value) {
  return String(value || "")
    // Grounding redirects and signed links can contain sensitive opaque IDs.
    .replace(/https?:\/\/([^\s/'"?]+)(?:\/[^\s'"?]*)?(?:\?[^\s'" ]*)?/gu, "https://$1/…")
    .replace(/[\r\n]+/gu, " ")
    .trim();
}

function actionOf(tool, parameters) {
  const command = String(parameters.CommandLine || "").trim();
  if (tool === "search_web") return "Search for reporting";
  if (tool === "read_url_content" || tool.startsWith("browser_")) return "Open or inspect a source";
  if (tool === "read_file") return "Read project context or data";
  if (tool === "run_command") {
    const match = command.match(/research\/cli\.mjs\s+([\w-]+)/u);
    if (match) return `Research CLI: ${match[1]}`;
    if (/\bgit\b/u.test(command)) return "Inspect Git history or changes";
    return "Inspect or check the workspace";
  }
  if (/edit|write|replace|patch/u.test(tool)) return "Edit research data";
  return tool || "Tool action";
}

function detailOf(tool, parameters) {
  if (tool === "search_web") return safeDetail(parameters.query);
  if (tool === "run_command") return safeDetail(parameters.CommandLine);
  if (tool === "read_file") return basename(String(parameters.Path || parameters.path || ""));
  return safeDetail(parameters.Url || parameters.url || parameters.Path || parameters.path || "");
}

function stepsFromEvents(logDir, runId) {
  const steps = [];
  const attempts = [];
  for (const file of eventFiles(logDir, runId)) {
    let malformedLines = 0;
    let eventCount = 0;
    let conversationId = null;
    for (const line of (readText(join(logDir, file.name)) || "").split(/\r?\n/u)) {
      if (!line.trim()) continue;
      let event;
      try { event = JSON.parse(line); } catch { malformedLines++; continue; }
      eventCount++;
      conversationId = conversationId
        || event.conversation_id
        || event.result?.conversation_id
        || event.step_update?.conversation_id
        || null;
      const step = event.step_update;
      if (step?.step_type !== "tool" || step.state !== "DONE") continue;
      const parameters = step.tool_info?.parameters || {};
      const output = String(step.tool_info?.output || "");
      const exit = output.match(/Command exited with code (\d+)/u);
      steps.push({
        attempt: file.attempt,
        step: Number(step.step_index),
        action: actionOf(step.tool_name, parameters),
        detail: detailOf(step.tool_name, parameters),
        tool: String(step.tool_name || ""),
        outcome: exit ? `exit ${exit[1]}` : "completed",
      });
    }
    attempts.push({ attempt: file.attempt, conversationId, eventsFile: file.name, eventCount, malformedLines });
  }
  return { attempts, steps };
}

function changedPaths(patchText) {
  return [...new Set((patchText || "").split(/\r?\n/u).flatMap((line) => {
    const match = line.match(/^\+\+\+ b\/(data\/[^\t\r\n]+)/u);
    return match ? [match[1]] : [];
  }))];
}

export function buildCycleReport(runId, options = {}) {
  safeRunId(runId);
  const runnerRoot = resolve(options.runnerRoot || defaultRunnerRoot);
  const logDir = resolve(options.logDir || join(runnerRoot, "logs"));
  const runtime = readJson(join(resolve(options.runtimeDir || join(runnerRoot, "runtime")), "runtime.json"));
  const current = runtime?.runId === runId ? runtime : null;
  const completion = readJson(join(logDir, `${runId}.completion.json`));
  const delivery = readJson(join(logDir, `${runId}.delivery.json`));
  const resultFilesFound = resultFiles(logDir, runId);
  const results = resultFilesFound.map(({ name, attempt }) => ({ attempt, name, result: readJson(join(logDir, name)) }));
  const lastResult = [...results].reverse().find(({ result }) => result)?.result || null;
  const runDir = current?.runDir || join(resolve(options.runsRoot || join(runnerRoot, "runs")), runId);
  const finish = readJson(join(runDir, ".work", "research-finish.json"));
  const historyPath = join(resolve(options.historyDir || join(dirname(logDir), "history")), runId);
  const previous = readJson(join(historyPath, "report.json"));
  const correction = readJson(join(historyPath, "correction.json")) || previous?.correction || null;
  const eventTrace = stepsFromEvents(logDir, runId);
  const attempts = eventTrace.attempts.length ? eventTrace.attempts.map((attempt) => {
    const result = results.find((item) => item.attempt === attempt.attempt);
    return {
      ...attempt,
      conversationId: attempt.conversationId || result?.result?.conversation_id || null,
      resultFile: result?.name || null,
      resultStatus: result?.result?.status || null,
    };
  }) : (previous?.attempts || []);
  const steps = eventTrace.attempts.length ? eventTrace.steps : (previous?.steps || []);
  const patchPath = join(logDir, `${runId}.data.patch`);
  const patch = readText(patchPath);
  const feedback = readText(join(logDir, `${runId}.feedback.txt`))?.trim() || null;
  const lastResultEntry = [...results].reverse().find(({ result }) => result) || null;
  const conversationIds = [...new Set([
    ...attempts.map((attempt) => attempt.conversationId),
    ...results.map(({ result }) => result?.conversation_id),
    current?.conversationId,
  ].filter(Boolean))];
  const failedActions = steps.filter((step) => step.outcome !== "completed" && step.outcome !== "exit 0");

  const status = delivery?.status === "verified" ? "published"
    : current?.status || (delivery?.status === "awaiting-public" ? "awaiting-publication"
      : completion ? "completed"
        : lastResult?.status === "SUCCESS" ? "agent-finished"
          : lastResult ? "agent-error"
            : previous?.status && previous.status !== "started" ? previous.status : "incomplete-unverified");
  const outcome = completion?.reason || finish?.reason || previous?.outcome || null;
  const report = {
    schemaVersion: 1,
    runId,
    startedAt: startIso(runId),
    savedAt: new Date().toISOString(),
    status,
    model: current?.model || previous?.model || "gemini-4-hydrogen-medium",
    baseHead: current?.baseHead || completion?.baseHead || delivery?.baseHead || previous?.baseHead || null,
    decision: finish?.decision || (completion ? "complete" : previous?.decision || null),
    outcome,
    nextCadenceHours: completion?.intervalHours ?? finish?.intervalHours ?? previous?.nextCadenceHours ?? null,
    publishedCommit: delivery?.candidateCommit || previous?.publishedCommit || null,
    servedCommit: delivery?.servedCommit || previous?.servedCommit || null,
    publicationStatus: delivery?.status || null,
    agentStatus: lastResult?.status || null,
    agentReport: lastResult?.response || previous?.agentReport || null,
    conversationIds,
    attempts,
    toolCounts: Object.fromEntries([...new Set(steps.map((s) => s.tool))].sort().map((tool) => [tool, steps.filter((s) => s.tool === tool).length])),
    steps,
    failedActions,
    changedPaths: patch !== null ? changedPaths(patch) : previous?.changedPaths || [],
    feedback,
    feedbackContext: feedback ? {
      kind: "agent-harness-feedback",
      attempt: lastResultEntry?.attempt ?? null,
      conversationId: lastResultEntry?.result?.conversation_id || conversationIds.at(-1) || null,
      resultFile: lastResultEntry?.name || null,
      feedbackFile: `${runId}.feedback.txt`,
    } : null,
    correction,
    artifacts: {
      logs: logDir,
      events: attempts.map((a) => join(logDir, a.eventsFile)),
      results: results.map((r) => join(logDir, r.name)),
      patch: patch !== null ? patchPath : null,
      completion: completion ? join(logDir, `${runId}.completion.json`) : null,
      delivery: delivery ? join(logDir, `${runId}.delivery.json`) : null,
      rawFiles: existsSync(logDir) ? readdirSync(logDir)
        .filter((name) => name.startsWith(`${runId}.`))
        .sort()
        .map((name) => join(logDir, name)) : [],
      workspace: existsSync(runDir) ? runDir : null,
    },
  };
  // Old saved reports remain useful after workspace cleanup. The live trace,
  // completion receipt, and delivery receipt are preferred when available.
  return report;
}

function markdown(report) {
  const logLink = (name) => `../../logs/${name}`;
  const lines = [
    `# BorderClash research cycle ${report.runId}`,
    "",
    `- Started: ${report.startedAt || "unknown"}`,
    `- Status: **${report.status}**`,
    `- Base commit: ${report.baseHead || "unknown"}`,
    `- Research decision: ${report.decision || "not recorded"}`,
    `- Outcome: ${report.outcome || "not recorded yet"}`,
    `- Next cadence: ${report.nextCadenceHours == null ? "not recorded" : `${report.nextCadenceHours} hours`}`,
    `- Published commit: ${report.publishedCommit || "none"}`,
    `- Served commit: ${report.servedCommit || "not verified"}`,
    `- Conversation: ${report.conversationIds?.join(", ") || "not recorded"}`,
    "",
    ...(report.correction ? [
      "## Post-publication correction",
      "",
      `- Corrected commit: ${report.correction.correctedCommit || "not recorded"}`,
      `- Prevention commit: ${report.correction.preventionCommit || "not recorded"}`,
      `- Reason: ${report.correction.reason || "not recorded"}`,
      "",
    ] : []),
    "## Diagnostic context",
    "",
    ...(report.attempts.length ? report.attempts.map((attempt) => `- Attempt ${attempt.attempt + 1}: conversation \`${attempt.conversationId || "unknown"}\`; result ${attempt.resultStatus || "not recorded"}; [trace](${logLink(attempt.eventsFile)})${attempt.resultFile ? `; [result](${logLink(attempt.resultFile)})` : ""}`) : ["No attempt trace was retained."]),
    `- Agent harness feedback: ${report.feedback ? `${report.feedback} ([feedback file](${logLink(report.feedbackContext?.feedbackFile || `${report.runId}.feedback.txt`)}))` : "none recorded"}`,
    ...(report.failedActions?.length ? ["- Non-zero/failed tool actions:", ...report.failedActions.map((step) => `  - Attempt ${step.attempt + 1}, step ${step.step}: ${step.action} — ${step.outcome}`)] : ["- Non-zero/failed tool actions: none recorded"]),
    "",
    "## What the agent actually did",
    "",
    "| Attempt / step | Action | Detail | Result |",
    "| --- | --- | --- | --- |",
    ...report.steps.map((s) => `| ${s.attempt + 1} / ${s.step} | ${s.action} | ${s.detail.replaceAll("|", "\\|")} | ${s.outcome} |`),
    "",
    "## Agent's final report",
    "",
    report.agentReport || "Not available yet.",
    "",
    "## Changed canonical files",
    "",
    ...(report.changedPaths.length ? report.changedPaths.map((f) => `- \`${f}\``) : ["No canonical data patch recorded."]),
    "",
    "## Retained evidence for review",
    "",
    `- Event traces: ${report.attempts.map((a) => `[${a.eventsFile}](${logLink(a.eventsFile)})`).join(", ") || "none yet"}`,
    `- Final result: ${report.artifacts.results.map((f) => `[${basename(f)}](${logLink(basename(f))})`).join(", ") || "not available yet"}`,
    `- Data patch: ${report.artifacts.patch ? `[${basename(report.artifacts.patch)}](${logLink(basename(report.artifacts.patch))})` : "not available"}`,
    `- Publication receipt: ${report.artifacts.delivery ? `[${basename(report.artifacts.delivery)}](${logLink(basename(report.artifacts.delivery))})` : "not available"}`,
    `- Agent harness feedback: ${report.feedback || "none recorded"}`,
    `- Full technical log files: ${report.artifacts.rawFiles.length}`,
    "",
    "The full raw log files are local to the research server and are not published to the website.",
    "",
  ];
  return lines.join("\n");
}

function saveReport(report, historyDir) {
  const dir = join(historyDir, report.runId);
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of [["report.json", JSON.stringify(report, null, 2) + "\n"], ["report.md", markdown(report)]]) {
    const destination = join(dir, name);
    const temporary = `${destination}.${process.pid}.tmp`;
    writeFileSync(temporary, content, { mode: 0o600 });
    renameSync(temporary, destination);
  }
  const summaries = (existsSync(historyDir) ? readdirSync(historyDir) : [])
    .filter((name) => runIdPattern.test(name))
    .map((name) => readJson(join(historyDir, name, "report.json")))
    .filter(Boolean)
    .sort((a, b) => String(b.runId).localeCompare(String(a.runId)));
  const index = [
    "# BorderClash research cycle history",
    "",
    "Private South Server review history. Start with the per-cycle `report.md`; use the linked raw trace files only when deeper diagnosis is needed.",
    "",
    "| Run | Status | Conversation | Outcome |",
    "| --- | --- | --- | --- |",
    ...summaries.map((item) => `| [${item.runId}](${item.runId}/report.md) | ${item.correction ? `${item.status} (corrected)` : item.status} | ${item.conversationIds?.at(-1) || "not recorded"} | ${String(item.outcome || "not recorded").replaceAll("|", "\\|")} |`),
    "",
  ].join("\n");
  const indexPath = join(historyDir, "INDEX.md");
  const indexTemp = `${indexPath}.${process.pid}.tmp`;
  writeFileSync(indexTemp, index, { mode: 0o600 });
  renameSync(indexTemp, indexPath);
  return dir;
}

function knownCycles(logDir, historyDir) {
  const ids = new Set();
  for (const name of existsSync(logDir) ? readdirSync(logDir) : []) {
    const match = name.match(/^(\d{8}T\d{9}Z)(?:\.resume-\d+)?\.(?:events\.ndjson|result\.json|completion\.json|delivery\.json|context\.md)$/u);
    if (match) ids.add(match[1]);
  }
  for (const name of existsSync(historyDir) ? readdirSync(historyDir) : []) {
    if (runIdPattern.test(name)) ids.add(name);
  }
  return [...ids].sort().reverse();
}

function main(argv) {
  const [command, maybeId, ...rest] = argv;
  const optionArgs = command === "list" && maybeId !== undefined ? [maybeId, ...rest] : rest;
  const options = {};
  for (let i = 0; i < optionArgs.length; i += 2) {
    const flag = optionArgs[i];
    if (!["--runner-root", "--log-dir", "--runtime-dir", "--runs-root", "--history-dir"].includes(flag) || !optionArgs[i + 1]) {
      throw new Error(`Invalid history option ${flag || "<end>"}`);
    }
    options[{
      "--runner-root": "runnerRoot",
      "--log-dir": "logDir",
      "--runtime-dir": "runtimeDir",
      "--runs-root": "runsRoot",
      "--history-dir": "historyDir",
    }[flag]] = resolve(optionArgs[i + 1]);
  }
  const runnerRoot = options.runnerRoot || defaultRunnerRoot;
  const logDir = options.logDir || join(runnerRoot, "logs");
  const historyDir = options.historyDir || join(dirname(logDir), "history");
  if (!["list", "show", "save"].includes(command)) {
    throw new Error("Usage: node research/automation/cycle-history.mjs list | show <run-id> | save <run-id|--all> [--runner-root <path>]");
  }
  const ids = knownCycles(logDir, historyDir);
  if (command === "list") {
    const reports = ids.map((id) => buildCycleReport(id, options));
    process.stdout.write(reports.map((r) => `${r.runId}  ${r.status.padEnd(20)} ${r.decision || "-"}  ${r.publishedCommit?.slice(0, 8) || "-"}`).join("\n") + "\n");
    return;
  }
  const selected = maybeId === "--all" && command === "save" ? ids : [safeRunId(maybeId)];
  for (const id of selected) {
    if (command !== "save" && !ids.includes(id)) throw new Error(`Unknown research cycle ${id}`);
    const report = buildCycleReport(id, options);
    if (command === "save") process.stdout.write(`Saved ${report.runId}: ${saveReport(report, historyDir)}\n`);
    else process.stdout.write(markdown(report));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
