import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import {
  buildAgentEnvironment,
  isAgentCredentialEnvironmentKey,
} from "../research/automation/agent-environment.mjs";

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
