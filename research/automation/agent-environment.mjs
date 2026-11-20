import { join } from "node:path";

const PUBLICATION_CREDENTIAL_RE = /^(?:VERCEL|GITHUB_TOKEN$|GH_TOKEN$|BORDERCLASH_(?:VERCEL|DEPLOY|PUBLISH))/iu;
const AMBIENT_GIT_CREDENTIAL_KEYS = new Set([
  "GIT_ASKPASS",
  "SSH_ASKPASS",
  "SSH_AUTH_SOCK",
  "SSH_AGENT_PID",
  "SSH_CONNECTION",
  "SSH_CLIENT",
  "SSH_TTY",
  "GIT_SSH_COMMAND",
]);

export function isAgentCredentialEnvironmentKey(key) {
  return PUBLICATION_CREDENTIAL_RE.test(String(key || ""))
    || AMBIENT_GIT_CREDENTIAL_KEYS.has(String(key || "").toUpperCase());
}

export function buildAgentEnvironment(cwd, { baseEnv = process.env, platform = process.platform } = {}) {
  const env = { ...baseEnv };
  for (const key of Object.keys(env)) {
    if (isAgentCredentialEnvironmentKey(key)) delete env[key];
  }
  env.GIT_TERMINAL_PROMPT = "0";
  env.GCM_INTERACTIVE = "never";
  env.GCM_CREDENTIAL_STORE = "none";
  env.GIT_CONFIG_NOSYSTEM = "1";
  env.GIT_CONFIG_GLOBAL = platform === "win32" ? "NUL" : "/dev/null";
  env.GH_CONFIG_DIR = join(cwd, ".work", "agent-gh-config");
  env.GH_PROMPT_DISABLED = "1";
  return env;
}
