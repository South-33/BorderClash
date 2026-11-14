import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_PUBLIC_URL = "https://border-clash.vercel.app/data/dashboard.json";

function gitEnv() {
  return {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    GCM_INTERACTIVE: "never",
  };
}

function validationEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (
      /^(?:VERCEL|GITHUB_TOKEN$|GH_TOKEN$|BORDERCLASH_(?:VERCEL|DEPLOY|PUBLISH))/iu.test(key)
      || /^(?:GIT_ASKPASS|SSH_ASKPASS|SSH_AUTH_SOCK|SSH_AGENT_PID|GIT_SSH_COMMAND)$/iu.test(key)
    ) {
      delete env[key];
    }
  }
  env.GIT_TERMINAL_PROMPT = "0";
  env.GCM_INTERACTIVE = "never";
  env.GIT_CONFIG_NOSYSTEM = "1";
  env.GIT_CONFIG_GLOBAL = process.platform === "win32" ? "NUL" : "/dev/null";
  return env;
}

function run(file, args, { cwd, input, allowFailure = false, env = gitEnv() } = {}) {
  const result = spawnSync(file, args, {
    cwd,
    input,
    encoding: "utf8",
    windowsHide: true,
    env,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${file} ${args.join(" ")} failed: ${(result.stderr || result.stdout || "").trim()}`);
  }
  return result;
}

function git(cwd, args, options = {}) {
  return run("git", args, { cwd, ...options });
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2) + "\n", "utf8");
  await rename(temp, path);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function lines(value) {
  return String(value || "")
    .split(/\r?\n/u)
    .map((row) => row.trim())
    .filter(Boolean);
}

function resolveCommit(cwd, ref) {
  return git(cwd, ["rev-parse", ref]).stdout.trim();
}

function dataTree(cwd, ref) {
  return resolveCommit(cwd, `${ref}:data`);
}

function stateText(cwd, ref) {
  return git(cwd, ["show", `${ref}:data/research-state.json`]).stdout;
}

function changedDataPaths(cwd, from, to) {
  return lines(git(cwd, ["diff", "--name-only", from, to, "--", "data"]).stdout);
}

function assertCycleIsDataOnly(runDir, baseHead, cycleCommit) {
  const changed = lines(git(runDir, ["diff", "--name-only", baseHead, cycleCommit, "--"]).stdout);
  const invalid = changed.filter((path) => !path.replaceAll("\\", "/").startsWith("data/"));
  if (invalid.length) throw new Error(`validated cycle contains non-data paths: ${invalid.join(", ")}`);
}

async function prepareCandidate({
  runDir,
  baseHead,
  cycleCommit,
  remoteUrl,
  candidateDir,
}) {
  await rm(candidateDir, { recursive: true, force: true });
  await mkdir(dirname(candidateDir), { recursive: true });
  run("git", ["clone", "--quiet", "--no-checkout", remoteUrl, candidateDir], { cwd: dirname(candidateDir) });
  git(candidateDir, ["fetch", "--quiet", "origin", "main"]);
  const latestHead = resolveCommit(candidateDir, "origin/main");

  const ancestor = git(candidateDir, ["merge-base", "--is-ancestor", baseHead, latestHead], { allowFailure: true });
  if (ancestor.status !== 0) {
    return { status: "review", reason: "Remote main no longer descends from the research cycle base." };
  }

  const cyclePaths = changedDataPaths(runDir, baseHead, cycleCommit);
  const upstreamPaths = changedDataPaths(candidateDir, baseHead, latestHead);
  if (stateText(candidateDir, baseHead) !== stateText(candidateDir, latestHead)) {
    return {
      status: "review",
      reason: "Another research cycle changed data/research-state.json while this cycle was in progress.",
      latestHead,
      cyclePaths,
      upstreamPaths,
    };
  }

  const upstreamSet = new Set(upstreamPaths);
  const overlap = cyclePaths.filter((path) => upstreamSet.has(path));
  if (overlap.length) {
    return {
      status: "review",
      reason: `Upstream changed the same canonical data path(s): ${overlap.join(", ")}`,
      latestHead,
      cyclePaths,
      upstreamPaths,
      overlap,
    };
  }

  git(candidateDir, ["checkout", "--quiet", "--detach", latestHead]);
  const patch = git(runDir, ["diff", "--binary", baseHead, cycleCommit, "--", "data"]).stdout;
  if (!patch.trim()) throw new Error("validated cycle has no canonical data change to publish");
  const applied = git(candidateDir, ["apply", "--3way", "--index", "--whitespace=nowarn", "-"], {
    input: patch,
    allowFailure: true,
  });
  if (applied.status !== 0) {
    return {
      status: "review",
      reason: `Three-way application onto current main failed: ${(applied.stderr || applied.stdout || "").trim()}`,
      latestHead,
      cyclePaths,
      upstreamPaths,
    };
  }

  const validatorEnv = validationEnv();
  run(process.execPath, [join(candidateDir, "research", "validate.mjs")], { cwd: candidateDir, env: validatorEnv });
  run(process.execPath, [join(candidateDir, "scripts", "generate-public.mjs")], { cwd: candidateDir, env: validatorEnv });
  git(candidateDir, ["diff", "--check"]);
  git(candidateDir, ["add", "-A", "--", "data"]);
  const stagedPaths = lines(git(candidateDir, ["diff", "--cached", "--name-only"]).stdout);
  if (!stagedPaths.length || stagedPaths.some((path) => !path.replaceAll("\\", "/").startsWith("data/"))) {
    throw new Error("publication candidate must contain data-only staged changes");
  }
  git(candidateDir, [
    "-c", "user.name=BorderClash Research",
    "-c", "user.email=borderclash-research@local.invalid",
    "commit", "--quiet", "-m", "research: publish validated cycle",
  ]);
  const candidateCommit = resolveCommit(candidateDir, "HEAD");
  return {
    status: "prepared",
    latestHead,
    candidateCommit,
    candidateDataTree: dataTree(candidateDir, candidateCommit),
    cyclePaths,
    upstreamPaths,
  };
}

function remoteContainsExpectedData(candidateDir, candidateCommit, expectedDataTree) {
  git(candidateDir, ["fetch", "--quiet", "origin", "main"]);
  const remoteHead = resolveCommit(candidateDir, "origin/main");
  const ancestor = git(candidateDir, ["merge-base", "--is-ancestor", candidateCommit, remoteHead], { allowFailure: true });
  if (ancestor.status !== 0) return { accepted: false, remoteHead };
  return {
    accepted: dataTree(candidateDir, remoteHead) === expectedDataTree,
    remoteHead,
  };
}

async function maybeTriggerDeployHook(pending) {
  const hook = String(process.env.BORDERCLASH_VERCEL_DEPLOY_HOOK || "").trim();
  const now = Date.now();
  const attempts = Number(pending.deployHookAttempts || 0);
  const attemptedAt = Number(pending.deployHookAttemptedAt || 0);
  const retryAfterMs = 15 * 60_000;
  if (
    !hook
    || pending.deployHookTriggeredAt
    || Number(pending.verificationAttempts || 0) < 3
    || attempts >= 2
    || (attemptedAt > 0 && now - attemptedAt < retryAfterMs)
  ) return;
  pending.deployHookAttempts = attempts + 1;
  pending.deployHookAttemptedAt = now;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(hook, { method: "POST", signal: controller.signal });
    if (response.ok) {
      pending.deployHookTriggeredAt = Date.now();
      pending.deployHookError = "";
    } else pending.deployHookError = `HTTP ${response.status}`;
  } catch (error) {
    pending.deployHookError = String(error?.message || error);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchDashboard(url, timeoutMs = 15_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const target = new URL(url);
    target.searchParams.set("_borderclash", String(Date.now()));
    const response = await fetch(target, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "cache-control": "no-cache" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function servedCommitAcceptable(candidateDir, pending, servedCommit) {
  if (!servedCommit) return false;
  if (servedCommit === pending.candidateCommit) return true;
  git(candidateDir, ["fetch", "--quiet", "origin", "main"]);
  const known = git(candidateDir, ["cat-file", "-e", `${servedCommit}^{commit}`], { allowFailure: true });
  if (known.status !== 0) return false;
  const ancestor = git(candidateDir, ["merge-base", "--is-ancestor", pending.candidateCommit, servedCommit], { allowFailure: true });
  if (ancestor.status !== 0) return false;
  return dataTree(candidateDir, servedCommit) === pending.expectedDataTree;
}

export async function verifyPendingPublication({
  pendingPath,
  publicUrl = process.env.BORDERCLASH_PUBLIC_DASHBOARD_URL || DEFAULT_PUBLIC_URL,
  timeoutMs = Number(process.env.BORDERCLASH_VERIFY_TIMEOUT_MS || 60_000),
  intervalMs = Number(process.env.BORDERCLASH_VERIFY_INTERVAL_MS || 5_000),
}) {
  const pending = await readJson(pendingPath);
  if (pending.status === "verified" || pending.status === "review") return pending;
  const candidateDir = pending.candidateDir;
  if (!candidateDir || !existsSync(candidateDir)) {
    return { ...pending, status: "review", reason: "Pending publication candidate workspace is missing." };
  }

  const deadline = Date.now() + Math.max(0, timeoutMs);
  let lastError = "";
  do {
    pending.verificationAttempts = Number(pending.verificationAttempts || 0) + 1;
    try {
      const dashboard = await fetchDashboard(publicUrl);
      const research = dashboard?.researchState;
      const stateMatches = Number(research?.lastResearchAt) === Number(pending.expectedResearchState.lastResearchAt)
        && Number(research?.nextRunAt) === Number(pending.expectedResearchState.nextRunAt);
      const commitMatches = servedCommitAcceptable(candidateDir, pending, String(dashboard?.deploymentVersion || ""));
      if (stateMatches && commitMatches) {
        pending.status = "verified";
        pending.verifiedAt = Date.now();
        pending.servedCommit = String(dashboard.deploymentVersion);
        pending.lastError = "";
        await writeJsonAtomic(pendingPath, pending);
        return pending;
      }
      lastError = stateMatches
        ? "served commit does not carry the candidate data tree"
        : "served research state does not match the candidate";
    } catch (error) {
      lastError = String(error?.message || error);
    }
    pending.lastError = lastError;
    await maybeTriggerDeployHook(pending);
    await writeJsonAtomic(pendingPath, pending);
    if (Date.now() >= deadline) break;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, Math.max(10, intervalMs)));
  } while (Date.now() <= deadline);

  pending.status = "awaiting-public";
  pending.lastError = lastError;
  await writeJsonAtomic(pendingPath, pending);
  return pending;
}

export async function publishValidatedCycle({
  repoRoot,
  runDir,
  baseHead,
  cycleCommit,
  remoteName,
  candidateRoot,
  pendingPath,
  runId,
  cycleStartedAt,
  expectedResearchState,
  beforePush,
  simulateLostPushResult = false,
  maxPushAttempts = 3,
}) {
  assertCycleIsDataOnly(runDir, baseHead, cycleCommit);
  const startedAt = Number(cycleStartedAt || Date.now());
  if (!Number.isFinite(startedAt) || startedAt <= 0) throw new Error("cycleStartedAt must be a positive timestamp");
  const remoteUrl = git(repoRoot, ["remote", "get-url", remoteName]).stdout.trim();
  if (!remoteUrl) throw new Error(`Could not resolve remote URL for ${remoteName}`);
  const candidateDir = resolve(candidateRoot, `publish-${runId}`);

  for (let attempt = 1; attempt <= maxPushAttempts; attempt += 1) {
    const prepared = await prepareCandidate({ runDir, baseHead, cycleCommit, remoteUrl, candidateDir });
    if (prepared.status === "review") {
      const result = { ...prepared, runId, sourceRunDir: runDir, baseHead, candidateDir, cycleStartedAt: startedAt };
      await writeJsonAtomic(pendingPath, result);
      return result;
    }

    const pending = {
      schemaVersion: 1,
      status: "prepared",
      runId,
      cycleStartedAt: startedAt,
      baseHead,
      sourceRunDir: runDir,
      sourceCycleCommit: cycleCommit,
      candidateDir,
      candidateCommit: prepared.candidateCommit,
      expectedDataTree: prepared.candidateDataTree,
      expectedResearchState,
      remoteBase: prepared.latestHead,
      pushAttempt: attempt,
      preparedAt: Date.now(),
    };
    await writeJsonAtomic(pendingPath, pending);

    if (beforePush) await beforePush({ attempt, pending, remoteUrl });
    let pushed = git(candidateDir, ["push", "origin", `${prepared.candidateCommit}:refs/heads/main`], { allowFailure: true });
    if (simulateLostPushResult && pushed.status === 0) {
      pushed = { ...pushed, status: 1, stderr: "simulated lost push result" };
    }
    const remote = remoteContainsExpectedData(candidateDir, prepared.candidateCommit, prepared.candidateDataTree);
    if (pushed.status === 0 || remote.accepted) {
      pending.status = "awaiting-public";
      pending.gitAcceptedAt = Date.now();
      pending.acceptedRemoteHead = remote.remoteHead;
      if (pushed.status !== 0) pending.pushResult = "ambiguous-but-confirmed";
      await writeJsonAtomic(pendingPath, pending);
      return pending;
    }
  }

  const failed = await readJson(pendingPath);
  failed.status = "review";
  failed.reason = `Remote main kept advancing during ${maxPushAttempts} bounded publication attempts.`;
  await writeJsonAtomic(pendingPath, failed);
  return failed;
}

export async function resumePendingPublication({
  repoRoot,
  remoteName,
  candidateRoot,
  pendingPath,
  publicUrl,
  timeoutMs,
  intervalMs,
}) {
  let pending = await readJson(pendingPath);
  if (pending.status === "verified" || pending.status === "review") return pending;

  if (pending.status === "prepared") {
    const candidateDir = pending.candidateDir;
    if (!candidateDir || !existsSync(candidateDir)) {
      pending.status = "review";
      pending.reason = "Prepared publication candidate workspace is missing.";
      await writeJsonAtomic(pendingPath, pending);
      return pending;
    }
    const remote = remoteContainsExpectedData(candidateDir, pending.candidateCommit, pending.expectedDataTree);
    if (remote.accepted) {
      pending.status = "awaiting-public";
      pending.gitAcceptedAt = Date.now();
      pending.acceptedRemoteHead = remote.remoteHead;
      pending.pushResult = "confirmed-after-runner-restart";
      await writeJsonAtomic(pendingPath, pending);
    } else {
      pending = await publishValidatedCycle({
        repoRoot,
        runDir: pending.sourceRunDir,
        baseHead: pending.baseHead,
        cycleCommit: pending.sourceCycleCommit,
        remoteName,
        candidateRoot,
        pendingPath,
        runId: pending.runId,
        cycleStartedAt: pending.cycleStartedAt || pending.preparedAt,
        expectedResearchState: pending.expectedResearchState,
      });
      if (pending.status === "review") return pending;
    }
  }

  if (pending.status === "awaiting-public") {
    return verifyPendingPublication({ pendingPath, publicUrl, timeoutMs, intervalMs });
  }
  return pending;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value == null) throw new Error(`Invalid argument near ${key || "<end>"}`);
    args[key.slice(2)] = value;
  }
  return args;
}

async function cli() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (command === "publish") {
    const cycleStartedAt = Number(args["cycle-started-at"]);
    const expectedLastResearchAt = Number(args["expected-last-research-at"]);
    const expectedNextRunAt = Number(args["expected-next-run-at"]);
    if (!Number.isFinite(cycleStartedAt) || cycleStartedAt <= 0) {
      throw new Error("publish requires a positive cycle start timestamp");
    }
    if (!Number.isFinite(expectedLastResearchAt) || !Number.isFinite(expectedNextRunAt)) {
      throw new Error("publish requires finite expected research timestamps");
    }
    const result = await publishValidatedCycle({
      repoRoot: resolve(args["repo-root"]),
      runDir: resolve(args["run-dir"]),
      baseHead: args["base-head"],
      cycleCommit: args["cycle-commit"],
      remoteName: args["remote-name"],
      candidateRoot: resolve(args["candidate-root"]),
      pendingPath: resolve(args["pending-path"]),
      runId: args["run-id"],
      cycleStartedAt,
      expectedResearchState: {
        lastResearchAt: expectedLastResearchAt,
        nextRunAt: expectedNextRunAt,
      },
    });
    process.stdout.write(JSON.stringify(result) + "\n");
    return;
  }
  if (command === "verify") {
    const result = await verifyPendingPublication({
      pendingPath: resolve(args["pending-path"]),
      publicUrl: args["public-url"] || undefined,
      timeoutMs: args["timeout-ms"] ? Number(args["timeout-ms"]) : undefined,
      intervalMs: args["interval-ms"] ? Number(args["interval-ms"]) : undefined,
    });
    process.stdout.write(JSON.stringify(result) + "\n");
    return;
  }
  if (command === "resume") {
    const result = await resumePendingPublication({
      repoRoot: resolve(args["repo-root"]),
      remoteName: args["remote-name"],
      candidateRoot: resolve(args["candidate-root"]),
      pendingPath: resolve(args["pending-path"]),
      publicUrl: args["public-url"] || undefined,
      timeoutMs: args["timeout-ms"] ? Number(args["timeout-ms"]) : undefined,
      intervalMs: args["interval-ms"] ? Number(args["interval-ms"]) : undefined,
    });
    process.stdout.write(JSON.stringify(result) + "\n");
    return;
  }
  throw new Error("Usage: publish-candidate.mjs <publish|verify|resume> ...");
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  cli().catch((error) => {
    console.error(error?.stack || String(error));
    process.exitCode = 1;
  });
}
