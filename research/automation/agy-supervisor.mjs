import { spawn } from "node:child_process";
import { appendFileSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { extname } from "node:path";

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
  renameSync(tempPath, path);
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
  if (process.platform === "win32" && extname(executable).toLowerCase() === ".ps1") {
    return {
      file: "powershell.exe",
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", executable, ...args],
    };
  }
  return { file: executable, args };
}

async function runAttempt({
  agy,
  cwd,
  model,
  prompt,
  conversationId,
  timeoutMinutes,
  agyLogBase,
  eventsPath,
  stderrPath,
  sessionPath,
  attempt,
}) {
  const agyArgs = [];
  if (conversationId) agyArgs.push("--conversation", conversationId);
  agyArgs.push(
    "-p",
    prompt,
    "--dangerously-skip-permissions",
    "--output-format",
    "stream-json",
    "--model",
    model,
  );
  if (timeoutMinutes > 0) agyArgs.push("--print-timeout", `${timeoutMinutes}m`);
  agyArgs.push("--log-file", `${agyLogBase}.attempt-${attempt}.log`);

  const command = commandFor(agy, agyArgs);
  const startedAt = Date.now();
  const child = spawn(command.file, command.args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  let currentConversationId = conversationId || "";
  let result = null;
  let stderr = "";
  let lastStep = null;

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
    stderr += chunk;
    appendFileSync(stderrPath, chunk, "utf8");
  });

  child.stdout.setEncoding("utf8");
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  lines.on("line", (line) => {
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

  const exit = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code: code ?? 1, signal: signal || "" }));
  });

  const agyError = parseAgyError(stderr);
  const finishedReason = String(result?.finished_reason || "");
  const recoverable = finishedReason === "print_timeout" || agyError?.retryable === true;
  const recoveryReason = finishedReason === "print_timeout"
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
  const prompt = readFileSync(requireArg(args, "prompt-file"), "utf8").trim();
  const continuationPrompt = readFileSync(requireArg(args, "continuation-prompt-file"), "utf8").trim();
  const resultPath = requireArg(args, "result-file");
  const eventsPath = requireArg(args, "events-file");
  const stderrPath = requireArg(args, "stderr-file");
  const sessionPath = requireArg(args, "session-file");
  const agyLogBase = requireArg(args, "agy-log-base");
  const timeoutMinutes = Number(args["timeout-minutes"] || 0);
  const initialConversationId = String(args.conversation || "");
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
      prompt: activePrompt,
      conversationId,
      timeoutMinutes: activeTimeoutMinutes,
      agyLogBase,
      eventsPath,
      stderrPath,
      sessionPath,
      attempt,
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
