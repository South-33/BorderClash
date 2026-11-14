import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildAgentEnvironment,
  isAgentCredentialEnvironmentKey,
} from "../research/automation/agent-environment.mjs";
import {
  classifyPushDryRun,
  credentialFields,
  probePushDryRun,
} from "../research/automation/probe-agent-auth.mjs";

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.stdout || `git ${args.join(" ")} failed`);
  return String(result.stdout || "").trim();
}

test("agent environment removes publication and ambient Git credentials", () => {
  const baseEnv = {
    PATH: "fixture-path",
    GITHUB_TOKEN: "secret",
    GH_TOKEN: "secret",
    VERCEL_TOKEN: "secret",
    BORDERCLASH_DEPLOY_TOKEN: "secret",
    GIT_ASKPASS: "askpass",
    SSH_AUTH_SOCK: "agent",
    SSH_AGENT_PID: "123",
    GIT_SSH_COMMAND: "ssh fixture",
  };
  const cwd = join("C:\\", "fixture", "workspace");
  const env = buildAgentEnvironment(cwd, { baseEnv, platform: "win32" });

  assert.equal(env.PATH, "fixture-path");
  for (const key of Object.keys(baseEnv).filter(isAgentCredentialEnvironmentKey)) {
    assert.equal(env[key], undefined, key + " should not reach the model child");
  }
  assert.equal(env.GIT_TERMINAL_PROMPT, "0");
  assert.equal(env.GCM_INTERACTIVE, "never");
  assert.equal(env.GCM_CREDENTIAL_STORE, "none");
  assert.equal(env.GIT_CONFIG_NOSYSTEM, "1");
  assert.equal(env.GIT_CONFIG_GLOBAL, "NUL");
  assert.match(env.GH_CONFIG_DIR, /agent-gh-config$/u);
  assert.equal(env.GH_PROMPT_DISABLED, "1");
});

test("credential parser exposes field names without needing credential values", () => {
  assert.deepEqual(
    credentialFields("protocol=https\nusername=user\npassword=do-not-log-this\n"),
    ["protocol", "username", "password"],
  );
});

test("push dry-run classification distinguishes reachable, denied, and inconclusive results", () => {
  assert.equal(classifyPushDryRun({ status: 0, stdout: "", stderr: "" }), "write-reachable");
  assert.equal(classifyPushDryRun({ status: 128, stdout: "", stderr: "fatal: could not read Username" }), "write-denied");
  assert.equal(classifyPushDryRun({ status: 128, stdout: "", stderr: "Could not resolve host: github.com" }), "inconclusive");
});

test("push dry-run detects writable Git transport without creating the probe ref", () => {
  const root = mkdtempSync(join(tmpdir(), "borderclash-agent-auth-"));
  try {
    const remote = join(root, "remote.git");
    const repo = join(root, "repo");
    git(root, ["init", "--bare", remote]);
    git(root, ["init", repo]);
    git(repo, ["config", "user.name", "BorderClash Test"]);
    git(repo, ["config", "user.email", "borderclash-test@example.invalid"]);
    const file = join(repo, "fixture.txt");
    writeFileSync(file, "fixture\n", "utf8");
    git(repo, ["add", "fixture.txt"]);
    git(repo, ["commit", "-m", "fixture"]);

    const refName = "refs/heads/borderclash-agent-auth-probe";
    const env = buildAgentEnvironment(repo);
    const result = probePushDryRun(repo, env, remote, refName);
    assert.equal(result.classification, "write-reachable");
    assert.equal(result.exitCode, 0);
    const showRef = spawnSync("git", ["show-ref", "--verify", "--quiet", refName], {
      cwd: remote,
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(showRef.status, 1, "dry-run unexpectedly created the probe ref");
    assert.equal(readFileSync(file, "utf8"), "fixture\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
