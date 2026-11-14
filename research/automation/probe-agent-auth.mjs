import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildAgentEnvironment,
  isAgentCredentialEnvironmentKey,
} from "./agent-environment.mjs";

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value == null) throw new Error("arguments must be --name value pairs");
    out[key.slice(2)] = value;
  }
  return out;
}

function run(file, args, { cwd, env, input = "", timeout = 15_000 } = {}) {
  return spawnSync(file, args, {
    cwd,
    env,
    input,
    timeout,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
}

function output(result) {
  return String(result?.stdout || "") + "\n" + String(result?.stderr || "");
}

export function credentialFields(text) {
  const fields = new Set();
  for (const line of String(text || "").split(/\r?\n/u)) {
    const match = line.match(/^([^=\s]+)=/u);
    if (match) fields.add(match[1].toLowerCase());
  }
  return [...fields];
}

function returnedSecret(result) {
  const fields = credentialFields(result?.stdout);
  return fields.some((field) => ["password", "oauth_refresh_token", "authtype", "credential"].includes(field));
}

export function classifyPushDryRun(result) {
  if (result?.status === 0) return "write-reachable";
  const text = output(result);
  if (/(?:could not read Username|Authentication failed|permission denied|write access to repository not granted|not authorized|authentication required|publickey|HTTP 40[13])/iu.test(text)) {
    return "write-denied";
  }
  return "inconclusive";
}

function safeDiagnostic(result) {
  const text = output(result)
    .replace(/https:\/\/[^/@\s]+:[^/@\s]+@/giu, "https://[redacted]@")
    .replace(/(password|oauth_refresh_token|credential)=\S+/giu, "$1=[redacted]")
    .trim();
  return text.slice(0, 600);
}

function remoteDescriptor(urlText) {
  const raw = String(urlText || "").trim();
  if (!raw) return { protocol: "unknown", host: "", embeddedCredentials: false, githubRepository: "" };
  if (/^https?:\/\//iu.test(raw)) {
    try {
      const url = new URL(raw);
      const githubRepository = url.hostname.toLowerCase() === "github.com"
        ? url.pathname.replace(/^\//u, "").replace(/\.git$/u, "")
        : "";
      return {
        protocol: url.protocol.replace(":", ""),
        host: url.hostname,
        embeddedCredentials: Boolean(url.username || url.password),
        githubRepository,
      };
    } catch {
      return { protocol: "invalid", host: "", embeddedCredentials: false, githubRepository: "" };
    }
  }
  const ssh = raw.match(/^(?:ssh:\/\/)?(?:[^@\s]+@)?([^:/\s]+)[:/]([^\s]+)$/u);
  if (ssh) {
    return {
      protocol: "ssh",
      host: ssh[1],
      embeddedCredentials: false,
      githubRepository: ssh[1].toLowerCase() === "github.com" ? ssh[2].replace(/\.git$/u, "") : "",
    };
  }
  return { protocol: "local", host: "", embeddedCredentials: false, githubRepository: "" };
}

function helperNames(result) {
  if (result?.status !== 0) return [];
  return String(result.stdout || "")
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter((value) => /^[A-Za-z0-9._-]+$/u.test(value));
}

function directGcmProbe(cwd, env) {
  const input = "protocol=https\nhost=github.com\n\n";
  const variants = ["credential-manager", "credential-manager-core"];
  for (const variant of variants) {
    const version = run("git", [variant, "--version"], { cwd, env });
    if (version.error || version.status !== 0) continue;
    const result = run("git", [variant, "get"], { cwd, env, input });
    return {
      available: true,
      returnedSecret: returnedSecret(result),
      credentialFields: credentialFields(result.stdout).filter((field) => field !== "password"),
    };
  }
  return { available: false, returnedSecret: false, credentialFields: [] };
}

function ghTokenProbe(cwd, env) {
  const result = run("gh", ["auth", "token", "--hostname", "github.com"], { cwd, env });
  if (result.error?.code === "ENOENT") return { available: false, returnedToken: false };
  return { available: true, returnedToken: result.status === 0 && Boolean(String(result.stdout || "").trim()) };
}

export function probePushDryRun(cwd, env, remote, refName = "refs/heads/borderclash-agent-auth-probe") {
  const result = run("git", ["push", "--dry-run", remote, `HEAD:${refName}`], { cwd, env });
  return {
    classification: classifyPushDryRun(result),
    exitCode: result.status ?? -1,
    diagnostic: safeDiagnostic(result),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cwd = resolve(args.cwd || ".");
  const agentCwd = resolve(args["agent-cwd"] || cwd);
  const testPush = /^(?:1|true|yes)$/iu.test(String(args["push-dry-run"] || "false"));
  mkdirSync(join(agentCwd, ".work"), { recursive: true });

  const env = buildAgentEnvironment(agentCwd);
  const leakedCredentialEnvKeys = Object.keys(env).filter(isAgentCredentialEnvironmentKey).sort();
  const sanitizedHelpers = helperNames(run("git", ["config", "--get-all", "credential.helper"], { cwd, env }));
  const credentialFill = run("git", ["credential", "fill"], {
    cwd,
    env,
    input: "protocol=https\nhost=github.com\n\n",
  });
  const sanitizedCredentialReturned = returnedSecret(credentialFill);
  const sanitizedGh = ghTokenProbe(cwd, env);

  const originResult = run("git", ["remote", "get-url", "origin"], { cwd, env });
  const origin = remoteDescriptor(originResult.status === 0 ? originResult.stdout : "");

  // A tool-capable model can deliberately call account-level helpers even if
  // Git's normal helper/config path is hidden. Probe those bypasses directly.
  const sanitizedGcm = directGcmProbe(cwd, env);
  const defaultGcmEnv = { ...env };
  delete defaultGcmEnv.GCM_CREDENTIAL_STORE;
  delete defaultGcmEnv.GIT_CONFIG_NOSYSTEM;
  delete defaultGcmEnv.GIT_CONFIG_GLOBAL;
  const defaultGcm = directGcmProbe(cwd, defaultGcmEnv);
  const defaultGhEnv = { ...env };
  delete defaultGhEnv.GH_CONFIG_DIR;
  delete defaultGhEnv.GITHUB_TOKEN;
  delete defaultGhEnv.GH_TOKEN;
  const defaultGh = ghTokenProbe(cwd, defaultGhEnv);

  const refName = "refs/heads/borderclash-agent-auth-probe";
  const push = { attempted: testPush, https: null, ssh: null };
  if (testPush && origin.githubRepository) {
    const httpsRemote = `https://github.com/${origin.githubRepository}.git`;
    push.https = probePushDryRun(cwd, env, httpsRemote, refName);
    const sshEnv = {
      ...env,
      GIT_SSH_COMMAND: `ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="${join(agentCwd, ".work", "ssh-known-hosts")}"`,
    };
    push.ssh = probePushDryRun(cwd, sshEnv, `git@github.com:${origin.githubRepository}.git`, refName);
  }

  const noAmbientCredentialPath = leakedCredentialEnvKeys.length === 0
    && sanitizedHelpers.length === 0
    && !sanitizedCredentialReturned
    && !sanitizedGh.returnedToken
    && !origin.embeddedCredentials;
  const accountCredentialBypassDetected = defaultGcm.returnedSecret || defaultGh.returnedToken;
  const pushChecks = [push.https, push.ssh].filter(Boolean);
  const pushPrivilegeVerifiedAbsent = pushChecks.length > 0
    && pushChecks.every(({ classification }) => classification === "write-denied");

  const report = {
    schemaVersion: 1,
    cwd,
    agentCwd,
    origin,
    isolation: {
      leakedCredentialEnvKeys,
      credentialHelpers: sanitizedHelpers,
      credentialFillReturnedSecret: sanitizedCredentialReturned,
      ghAvailable: sanitizedGh.available,
      ghReturnedToken: sanitizedGh.returnedToken,
      gitCredentialManagerAvailable: sanitizedGcm.available,
      gitCredentialManagerReturnedSecret: sanitizedGcm.returnedSecret,
      noAmbientCredentialPath,
    },
    deliberateBypass: {
      gitCredentialManagerAvailable: defaultGcm.available,
      gitCredentialManagerReturnedSecret: defaultGcm.returnedSecret,
      gitCredentialManagerFields: defaultGcm.credentialFields,
      ghDefaultConfigAvailable: defaultGh.available,
      ghDefaultConfigReturnedToken: defaultGh.returnedToken,
      accountCredentialBypassDetected,
    },
    pushDryRun: push,
    pushPrivilegeVerifiedAbsent,
    readyForSouthPrivilegeAcceptance: noAmbientCredentialPath
      && !accountCredentialBypassDetected
      && pushPrivilegeVerifiedAbsent,
  };

  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (!noAmbientCredentialPath || accountCredentialBypassDetected || (testPush && !pushPrivilegeVerifiedAbsent)) {
    process.exitCode = 2;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exitCode = 1;
  });
}
