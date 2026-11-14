import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  publishValidatedCycle,
  resumePendingPublication,
  verifyPendingPublication,
} from "../research/automation/publish-candidate.mjs";

const sourceRepo = resolve(".");

function run(file, args, cwd, allowFailure = false) {
  const result = spawnSync(file, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${file} ${args.join(" ")} failed: ${(result.stderr || result.stdout || "").trim()}`);
  }
  return result;
}

function git(cwd, args, allowFailure = false) {
  return run("git", args, cwd, allowFailure);
}

async function writeJson(path, value) {
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "borderclash-publication-"));
  const controller = join(root, "controller");
  const remote = join(root, "remote.git");
  const runDir = join(root, "run");
  const candidateRoot = join(root, "candidates");
  const pendingPath = join(root, "runtime", "pending-publication.json");

  git(root, ["clone", "--quiet", "--no-checkout", "--no-hardlinks", sourceRepo, controller]);
  git(controller, ["checkout", "--quiet", "--detach", "HEAD"]);
  git(root, ["init", "--bare", remote]);
  git(controller, ["remote", "set-url", "origin", remote]);
  const baseHead = git(controller, ["rev-parse", "HEAD"]).stdout.trim();
  git(controller, ["push", "--quiet", "origin", `${baseHead}:refs/heads/main`]);

  git(root, ["clone", "--quiet", "--no-checkout", remote, runDir]);
  git(runDir, ["checkout", "--quiet", "--detach", baseHead]);
  const statePath = join(runDir, "data", "research-state.json");
  const state = JSON.parse(await readFile(statePath, "utf8"));
  state.lastResearchAt = Number(state.lastResearchAt) + 1000;
  state.nextRunAt = state.lastResearchAt + Number(state.lastCycleInterval || 24) * 3_600_000;
  state.researchCycleCount = Number(state.researchCycleCount) + 1;
  await writeJson(statePath, state);
  git(runDir, ["add", "data/research-state.json"]);
  git(runDir, [
    "-c", "user.name=Fixture",
    "-c", "user.email=fixture@example.invalid",
    "commit", "--quiet", "-m", "fixture research cycle",
  ]);
  const cycleCommit = git(runDir, ["rev-parse", "HEAD"]).stdout.trim();
  const cycleStartedAt = Date.now() - 45 * 60_000;

  return {
    root,
    controller,
    remote,
    runDir,
    candidateRoot,
    pendingPath,
    baseHead,
    cycleCommit,
    cycleStartedAt,
    expectedResearchState: {
      lastResearchAt: state.lastResearchAt,
      nextRunAt: state.nextRunAt,
    },
  };
}

function pushCodeOnlyCommit(fixture, message = "fixture code push") {
  const work = join(fixture.root, `code-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  git(fixture.root, ["clone", "--quiet", "--branch", "main", fixture.remote, work]);
  writeFileSyncUtf8(join(work, "README.md"), "\nfixture code-only descendant\n", true);
  git(work, ["add", "README.md"]);
  git(work, [
    "-c", "user.name=Fixture",
    "-c", "user.email=fixture@example.invalid",
    "commit", "--quiet", "-m", message,
  ]);
  git(work, ["push", "--quiet", "origin", "HEAD:main"]);
  return git(work, ["rev-parse", "HEAD"]).stdout.trim();
}

function writeFileSyncUtf8(path, text, append = false) {
  const mode = append ? "a" : "w";
  const result = spawnSync(process.execPath, [
    "-e",
    `require("fs").${mode === "a" ? "appendFileSync" : "writeFileSync"}(process.argv[1], process.argv[2], "utf8")`,
    path,
    text,
  ], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || "file write failed");
}

test("publication reconciles code-only movement and confirms a lost push result", async () => {
  const fixture = await createFixture();
  try {
    pushCodeOnlyCommit(fixture);
    const result = await publishValidatedCycle({
      ...fixture,
      repoRoot: fixture.controller,
      remoteName: "origin",
      runId: "code-only",
      simulateLostPushResult: true,
    });
    assert.equal(result.status, "awaiting-public");
    assert.equal(result.cycleStartedAt, fixture.cycleStartedAt);
    assert.equal(result.pushResult, "ambiguous-but-confirmed");
    const remoteHead = git(fixture.controller, ["--git-dir", fixture.remote, "rev-parse", "refs/heads/main"]).stdout.trim();
    assert.equal(remoteHead, result.candidateCommit);
    assert.notEqual(result.remoteBase, fixture.baseHead);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("publication validates with current main instead of agent-workspace code", async () => {
  const fixture = await createFixture();
  const priorDeployHook = process.env.BORDERCLASH_VERCEL_DEPLOY_HOOK;
  try {
    await writeFile(
      join(fixture.runDir, "research", "validate.mjs"),
      'throw new Error("agent workspace validator executed");\n',
      "utf8",
    );
    await writeFile(
      join(fixture.runDir, "scripts", "generate-public.mjs"),
      'throw new Error("agent workspace generator executed");\n',
      "utf8",
    );

    const trusted = join(fixture.root, "trusted-main");
    git(fixture.root, ["clone", "--quiet", "--branch", "main", fixture.remote, trusted]);
    for (const relativePath of ["research/validate.mjs", "scripts/generate-public.mjs"]) {
      const path = join(trusted, ...relativePath.split("/"));
      const source = await readFile(path, "utf8");
      await writeFile(
        path,
        'if (process.env.BORDERCLASH_VERCEL_DEPLOY_HOOK) throw new Error("publication secret leaked into final validation");\n' + source,
        "utf8",
      );
    }
    git(trusted, ["add", "research/validate.mjs", "scripts/generate-public.mjs"]);
    git(trusted, [
      "-c", "user.name=Fixture",
      "-c", "user.email=fixture@example.invalid",
      "commit", "--quiet", "-m", "fixture trusted validation boundary",
    ]);
    git(trusted, ["push", "--quiet", "origin", "HEAD:main"]);
    process.env.BORDERCLASH_VERCEL_DEPLOY_HOOK = "https://runner-only.invalid/deploy";

    const result = await publishValidatedCycle({
      ...fixture,
      repoRoot: fixture.controller,
      remoteName: "origin",
      runId: "trusted-publication-code",
    });
    assert.equal(result.status, "awaiting-public");
    assert.ok(result.candidateCommit);
  } finally {
    if (priorDeployHook === undefined) delete process.env.BORDERCLASH_VERCEL_DEPLOY_HOOK;
    else process.env.BORDERCLASH_VERCEL_DEPLOY_HOOK = priorDeployHook;
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("publication retries a push race but holds overlapping data for review", async () => {
  const fixture = await createFixture();
  try {
    let raced = false;
    const racedResult = await publishValidatedCycle({
      ...fixture,
      repoRoot: fixture.controller,
      remoteName: "origin",
      runId: "push-race",
      beforePush: async ({ attempt }) => {
        if (attempt === 1 && !raced) {
          raced = true;
          pushCodeOnlyCommit(fixture, "race code push");
        }
      },
    });
    assert.equal(racedResult.status, "awaiting-public");
    assert.equal(racedResult.pushAttempt, 2);

    const second = await createFixture();
    try {
      const upstream = join(second.root, "upstream");
      git(second.root, ["clone", "--quiet", "--branch", "main", second.remote, upstream]);
      const summaryPath = join(upstream, "data", "current", "summary.json");
      const summary = JSON.parse(await readFile(summaryPath, "utf8"));
      summary.summary += " Upstream fixture edit.";
      await writeJson(summaryPath, summary);
      git(upstream, ["add", "data/current/summary.json"]);
      git(upstream, [
        "-c", "user.name=Fixture",
        "-c", "user.email=fixture@example.invalid",
        "commit", "--quiet", "-m", "upstream data edit",
      ]);
      git(upstream, ["push", "--quiet", "origin", "HEAD:main"]);

      const runSummaryPath = join(second.runDir, "data", "current", "summary.json");
      const runSummary = JSON.parse(await readFile(runSummaryPath, "utf8"));
      runSummary.summary += " Cycle fixture edit.";
      await writeJson(runSummaryPath, runSummary);
      git(second.runDir, ["add", "data/current/summary.json"]);
      git(second.runDir, [
        "-c", "user.name=Fixture",
        "-c", "user.email=fixture@example.invalid",
        "commit", "--quiet", "--amend", "--no-edit",
      ]);
      second.cycleCommit = git(second.runDir, ["rev-parse", "HEAD"]).stdout.trim();

      const overlap = await publishValidatedCycle({
        ...second,
        repoRoot: second.controller,
        remoteName: "origin",
        runId: "overlap",
      });
      assert.equal(overlap.status, "review");
      assert.match(overlap.reason, /same canonical data path/u);
      assert.deepEqual(overlap.overlap, ["data/current/summary.json"]);
    } finally {
      await rm(second.root, { recursive: true, force: true });
    }
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

async function startFakePublic(fixture) {
  const portFile = join(fixture.root, "fake-public.port");
  const modeFile = join(fixture.root, "fake-public-mode.json");
  const workDir = join(fixture.root, "fake-public-work");
  const child = spawn(process.execPath, [
    resolve("tests", "automation", "fake-public.mjs"),
    "--remote", fixture.remote,
    "--port-file", portFile,
    "--work-dir", workDir,
    "--mode-file", modeFile,
  ], {
    cwd: sourceRepo,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const port = Number((await readFile(portFile, "utf8")).trim());
      if (port > 0) return { child, modeFile, url: `http://127.0.0.1:${port}/data/dashboard.json` };
    } catch {
      // Server has not published its port yet.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  child.kill();
  throw new Error("fake public endpoint did not start");
}

test("public delivery waits through stale or failed responses and accepts a code-only descendant", async () => {
  const fixture = await createFixture();
  let server;
  try {
    const published = await publishValidatedCycle({
      ...fixture,
      repoRoot: fixture.controller,
      remoteName: "origin",
      runId: "delivery",
    });
    assert.equal(published.status, "awaiting-public");
    server = await startFakePublic(fixture);

    await writeJson(server.modeFile, { commit: fixture.baseHead });
    const stale = await verifyPendingPublication({
      pendingPath: fixture.pendingPath,
      publicUrl: server.url,
      timeoutMs: 0,
      intervalMs: 10,
    });
    assert.equal(stale.status, "awaiting-public");
    assert.match(stale.lastError, /research state|candidate data tree/u);

    await writeJson(server.modeFile, { invalid: true });
    const invalid = await resumePendingPublication({
      repoRoot: fixture.controller,
      remoteName: "origin",
      candidateRoot: fixture.candidateRoot,
      pendingPath: fixture.pendingPath,
      publicUrl: server.url,
      timeoutMs: 0,
      intervalMs: 10,
    });
    assert.equal(invalid.status, "awaiting-public");
    assert.ok(invalid.lastError);

    await writeJson(server.modeFile, { fail: true });
    const failed = await resumePendingPublication({
      repoRoot: fixture.controller,
      remoteName: "origin",
      candidateRoot: fixture.candidateRoot,
      pendingPath: fixture.pendingPath,
      publicUrl: server.url,
      timeoutMs: 0,
      intervalMs: 10,
    });
    assert.equal(failed.status, "awaiting-public");
    assert.match(failed.lastError, /HTTP 503/u);

    const descendant = pushCodeOnlyCommit(fixture, "post-research code descendant");
    await writeJson(server.modeFile, {});
    const verified = await resumePendingPublication({
      repoRoot: fixture.controller,
      remoteName: "origin",
      candidateRoot: fixture.candidateRoot,
      pendingPath: fixture.pendingPath,
      publicUrl: server.url,
      timeoutMs: 5_000,
      intervalMs: 50,
    });
    assert.equal(verified.status, "verified");
    assert.equal(verified.servedCommit, descendant);
    assert.equal(verified.cycleStartedAt, fixture.cycleStartedAt);
    assert.ok(verified.verifiedAt > verified.cycleStartedAt);
  } finally {
    if (server?.child) server.child.kill();
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("failed deployment can trigger one runner-only deploy hook and still requires public verification", async () => {
  const fixture = await createFixture();
  let publicServer;
  let hookServer;
  const priorHook = process.env.BORDERCLASH_VERCEL_DEPLOY_HOOK;
  try {
    const published = await publishValidatedCycle({
      ...fixture,
      repoRoot: fixture.controller,
      remoteName: "origin",
      runId: "deploy-retry",
    });
    assert.equal(published.status, "awaiting-public");
    publicServer = await startFakePublic(fixture);
    await writeJson(publicServer.modeFile, { fail: true });

    let hookCount = 0;
    hookServer = createServer(async (request, response) => {
      if (request.method !== "POST") {
        response.writeHead(405).end();
        return;
      }
      hookCount += 1;
      await writeJson(publicServer.modeFile, {});
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{}");
    });
    await new Promise((resolvePromise) => hookServer.listen(0, "127.0.0.1", resolvePromise));
    const hookAddress = hookServer.address();
    process.env.BORDERCLASH_VERCEL_DEPLOY_HOOK = `http://127.0.0.1:${hookAddress.port}/deploy`;

    const verified = await verifyPendingPublication({
      pendingPath: fixture.pendingPath,
      publicUrl: publicServer.url,
      timeoutMs: 2_000,
      intervalMs: 50,
    });
    assert.equal(verified.status, "verified");
    assert.equal(hookCount, 1);
    assert.equal(verified.deployHookAttempts, 1);
    assert.ok(Number(verified.deployHookTriggeredAt) > 0);
    const pendingText = await readFile(fixture.pendingPath, "utf8");
    assert.doesNotMatch(pendingText, /127\.0\.0\.1:\d+\/deploy/u);
  } finally {
    if (priorHook === undefined) delete process.env.BORDERCLASH_VERCEL_DEPLOY_HOOK;
    else process.env.BORDERCLASH_VERCEL_DEPLOY_HOOK = priorHook;
    if (hookServer) await new Promise((resolvePromise) => hookServer.close(resolvePromise));
    if (publicServer?.child) publicServer.child.kill();
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("failed deploy hook is rate-limited while publication remains pending", async () => {
  const fixture = await createFixture();
  let publicServer;
  let hookServer;
  const priorHook = process.env.BORDERCLASH_VERCEL_DEPLOY_HOOK;
  try {
    await publishValidatedCycle({
      ...fixture,
      repoRoot: fixture.controller,
      remoteName: "origin",
      runId: "deploy-hook-rate-limit",
    });
    publicServer = await startFakePublic(fixture);
    await writeJson(publicServer.modeFile, { fail: true });

    let hookCount = 0;
    hookServer = createServer((_request, response) => {
      hookCount += 1;
      response.writeHead(503).end();
    });
    await new Promise((resolvePromise) => hookServer.listen(0, "127.0.0.1", resolvePromise));
    const hookAddress = hookServer.address();
    process.env.BORDERCLASH_VERCEL_DEPLOY_HOOK = `http://127.0.0.1:${hookAddress.port}/deploy`;

    const pending = await verifyPendingPublication({
      pendingPath: fixture.pendingPath,
      publicUrl: publicServer.url,
      timeoutMs: 350,
      intervalMs: 25,
    });
    assert.equal(pending.status, "awaiting-public");
    assert.equal(hookCount, 1);
    assert.equal(pending.deployHookAttempts, 1);
    assert.match(pending.deployHookError, /HTTP 503/u);
  } finally {
    if (priorHook === undefined) delete process.env.BORDERCLASH_VERCEL_DEPLOY_HOOK;
    else process.env.BORDERCLASH_VERCEL_DEPLOY_HOOK = priorHook;
    if (hookServer) await new Promise((resolvePromise) => hookServer.close(resolvePromise));
    if (publicServer?.child) publicServer.child.kill();
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("publication recovers after Git accepts the prepared commit but the runner restarts", async () => {
  const fixture = await createFixture();
  let server;
  try {
    const published = await publishValidatedCycle({
      ...fixture,
      repoRoot: fixture.controller,
      remoteName: "origin",
      runId: "restart-after-push",
    });
    assert.equal(published.status, "awaiting-public");

    const prepared = JSON.parse(await readFile(fixture.pendingPath, "utf8"));
    prepared.status = "prepared";
    delete prepared.gitAcceptedAt;
    delete prepared.acceptedRemoteHead;
    delete prepared.pushResult;
    await writeJson(fixture.pendingPath, prepared);

    server = await startFakePublic(fixture);
    await writeJson(server.modeFile, { commit: fixture.baseHead });
    const resumed = await resumePendingPublication({
      repoRoot: fixture.controller,
      remoteName: "origin",
      candidateRoot: fixture.candidateRoot,
      pendingPath: fixture.pendingPath,
      publicUrl: server.url,
      timeoutMs: 0,
      intervalMs: 10,
    });
    assert.equal(resumed.status, "awaiting-public");
    assert.equal(resumed.pushResult, "confirmed-after-runner-restart");
    assert.ok(resumed.gitAcceptedAt);
    assert.equal(resumed.cycleStartedAt, fixture.cycleStartedAt);
  } finally {
    if (server?.child) server.child.kill();
    await rm(fixture.root, { recursive: true, force: true });
  }
});
