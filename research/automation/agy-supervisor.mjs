import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { extname } from "node:path";
import { buildAgentEnvironment } from "./agent-environment.mjs";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) throw new Error(`unexpected argument: ${key}`);
    const value = argv[++i];
    if (value == null) throw new Error(`missing value for ${key}`);
    out[key.slice(2)] = value;
  }
  return out;
}

function requireArg(args, name) {
  const value = args[name];
  if (!value) throw new Error(`missing --${name}`);
  return value;
}

function writeJson(path, value) {
  const tempPath = `${path}.${process.pid}.tmp`;
  writeFileSync(tempPath, JSON.stringify(value, null, 2) + "\n", "utf8");
  for (let attempt = 0; ; attempt += 1) {
    try {
      renameSync(tempPath, path);
      return;
    } catch (error) {
      const retryable = process.platform === "win32"
        && ["EPERM", "EACCES", "EBUSY"].includes(String(error?.code || ""));
      if (!retryable || attempt >= 20) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.min(100, 10 * (attempt + 1)));
    }
  }
}

function parseAgyError(text) {
  let parsed = null;
  for (const line of text.split(/\r?\n/u)) {
    const index = line.indexOf("AGY_ERROR:");
    if (index < 0) continue;
    try {
      parsed = JSON.parse(line.slice(index + "AGY_ERROR:".length).trim());
    } catch {
      // Keep scanning. stderr remains preserved verbatim for diagnosis.
    }
  }
  return parsed;
}

function commandFor(executable, args) {
  if (extname(executable).toLowerCase() === ".ps1") {
    return {
      file: process.platform === "win32" ? "powershell.exe" : "pwsh",
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", executable, ...args],
    };
  }
  return { file: executable, args };
}

function stopProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    // The process may already have exited.
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runAttempt({
  agy,
  cwd,
  model,
  settingsPath,
  prompt,
  jsonSchemaPath,
  conversationId,
  timeoutMinutes,
  agyLogBase,
  eventsPath,
  stderrPath,
  sessionPath,
  attempt,
  stuckMinutes,
}) {
  const agyArgs = [];
  if (conversationId) agyArgs.push("--conversation", conversationId);
  if (settingsPath) agyArgs.push("--settings", settingsPath);
  agyArgs.push(
    "--input-format",
    "stream-json",
    "--print=",
    "--dangerously-skip-permissions",
    "--sandbox",
    "--output-format",
    "stream-json",
    "--model",
    model,
  );
  if (jsonSchemaPath) agyArgs.push("--json-schema", jsonSchemaPath);
  if (timeoutMinutes > 0) agyArgs.push("--print-timeout", `${timeoutMinutes}m`);
  agyArgs.push("--log-file", `${agyLogBase}.attempt-${attempt}.log`);

  const command = commandFor(agy, agyArgs);
  const startedAt = Date.now();
  const child = spawn(command.file, command.args, {
    cwd,
    detached: process.platform !== "win32",
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    env: buildAgentEnvironment(cwd),
  });

  const inputMessage = {
    event: "user",
    message: {
      role: "user",
      content: [{ type: "text", text: prompt }],
    },
  };
  child.stdin.on("error", (error) => {
    if (error?.code !== "EPIPE") {
      appendFileSync(stderrPath, `AGY supervisor stdin error: ${error?.message || error}\n`, "utf8");
    }
  });
  child.stdin.end(JSON.stringify(inputMessage) + "\n", "utf8");

  let currentConversationId = conversationId || "";
  let result = null;
  let stderr = "";
  let lastStep = null;
  let lastActivityAt = Date.now();
  let stuckTriggered = false;

  const saveSession = (extra = {}) => {
    writeJson(sessionPath, {
      status: "running",
      conversationId: currentConversationId,
      agyPid: child.pid,
      agyStartedAt: startedAt,
      model,
      cwd,
      attempt,
      lastStep,
      updatedAt: Date.now(),
      ...extra,
    });
  };
  saveSession();

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    lastActivityAt = Date.now();
    stderr += chunk;
    appendFileSync(stderrPath, chunk, "utf8");
  });

  child.stdout.setEncoding("utf8");
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  lines.on("line", (line) => {
    lastActivityAt = Date.now();
    appendFileSync(eventsPath, line + "\n", "utf8");
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }

    if (event.event === "init" && event.conversation_id) {
      currentConversationId = String(event.conversation_id);
      saveSession();
      return;
    }

    if (event.event === "step_update" && event.step_update) {
      const step = event.step_update;
      lastStep = {
        index: step.step_index,
        state: step.state,
        type: step.step_type,
        tool: step.tool_name || "",
      };
      if (step.conversation_id) currentConversationId = String(step.conversation_id);
      if (step.state === "DONE" || step.step_type === "checkpoint") saveSession();
      return;
    }

    if (event.event === "result" && event.result) {
      result = event.result;
      if (result.conversation_id) currentConversationId = String(result.conversation_id);
    }
  });

  const stuckMs = Number.isFinite(stuckMinutes) && stuckMinutes > 0
    ? stuckMinutes * 60_000
    : 0;
  const watchdog = stuckMs > 0
    ? setInterval(() => {
      if (!stuckTriggered && Date.now() - lastActivityAt >= stuckMs) {
        stuckTriggered = true;
        appendFileSync(stderrPath, `AGY supervisor stopped an inactive process after ${stuckMinutes} minutes.\n`, "utf8");
        stopProcessTree(child);
      }
    }, Math.min(30_000, Math.max(1_000, Math.floor(stuckMs / 4))))
    : null;

  const exit = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code: code ?? 1, signal: signal || "" }));
  });
  if (watchdog) clearInterval(watchdog);

  const agyError = parseAgyError(stderr);
  const finishedReason = String(result?.finished_reason || "");
  const recoverable = stuckTriggered || finishedReason === "print_timeout" || agyError?.retryable === true;
  const recoveryReason = stuckTriggered
    ? "stuck_timeout"
    : finishedReason === "print_timeout"
    ? "print_timeout"
    : agyError?.retryable === true
      ? `retryable:${agyError.status || agyError.canonical_status || "provider"}`
      : "";

  const attemptResult = {
    exitCode: exit.code,
    signal: exit.signal,
    conversationId: currentConversationId,
    result,
    agyError,
    recoverable,
    recoveryReason,
    startedAt,
    finishedAt: Date.now(),
  };
  saveSession({
    status: result?.status === "SUCCESS" && exit.code === 0 ? "success" : recoverable ? "recoverable" : "error",
    exitCode: exit.code,
    signal: exit.signal,
    recoveryReason,
    result,
    agyError,
  });
  return attemptResult;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const agy = requireArg(args, "agy");
  const cwd = requireArg(args, "cwd");
  const model = requireArg(args, "model");
  const settingsPath = String(args["settings-file"] || "");
  const prompt = readFileSync(requireArg(args, "prompt-file"), "utf8").trim();
  const continuationPrompt = readFileSync(requireArg(args, "continuation-prompt-file"), "utf8").trim();
  const resultPath = requireArg(args, "result-file");
  const eventsPath = requireArg(args, "events-file");
  const stderrPath = requireArg(args, "stderr-file");
  const sessionPath = requireArg(args, "session-file");
  const agyLogBase = requireArg(args, "agy-log-base");
  const timeoutMinutes = Number(args["timeout-minutes"] || 0);
  const stuckMinutes = Number(args["stuck-minutes"] || 90);
  const retryDelayMs = Math.max(0, Number(args["retry-delay-ms"] || 30_000));
  const initialConversationId = String(args.conversation || "");
  const jsonSchemaPath = String(args["json-schema-file"] || "");
  const maxImmediateRecoveries = 1;

  writeFileSync(eventsPath, "", "utf8");
  writeFileSync(stderrPath, "", "utf8");

  const attempts = [];
  let conversationId = initialConversationId;
  let activePrompt = initialConversationId ? continuationPrompt : prompt;
  let activeTimeoutMinutes = timeoutMinutes;

  for (let attempt = 1; ; attempt += 1) {
    const outcome = await runAttempt({
      agy,
      cwd,
      model,
      settingsPath,
      prompt: activePrompt,
      jsonSchemaPath,
      conversationId,
      timeoutMinutes: activeTimeoutMinutes,
      agyLogBase,
      eventsPath,
      stderrPath,
      sessionPath,
      attempt,
      stuckMinutes,
    });
    attempts.push(outcome);
    conversationId = outcome.conversationId || conversationId;

    if (outcome.result?.status === "SUCCESS" && outcome.exitCode === 0) {
      writeJson(resultPath, outcome.result);
      writeJson(sessionPath, {
        status: "success",
        conversationId,
        model,
        cwd,
        attempts: attempts.length,
        result: outcome.result,
        updatedAt: Date.now(),
      });
      return;
    }

    if (outcome.recoverable && conversationId && attempt <= maxImmediateRecoveries) {
      console.log(`RETRY: ${outcome.recoveryReason} conversation=${conversationId}`);
      if (retryDelayMs > 0) await delay(retryDelayMs);
      activePrompt = continuationPrompt;
      if (outcome.recoveryReason === "print_timeout") activeTimeoutMinutes = 0;
      continue;
    }

    if (outcome.result) writeJson(resultPath, outcome.result);
    writeJson(sessionPath, {
      status: outcome.recoverable && conversationId ? "recoverable" : "error",
      conversationId,
      model,
      cwd,
      attempts: attempts.length,
      exitCode: outcome.exitCode,
      signal: outcome.signal,
      recoveryReason: outcome.recoveryReason,
      result: outcome.result,
      agyError: outcome.agyError,
      updatedAt: Date.now(),
    });
    return;
  }
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
