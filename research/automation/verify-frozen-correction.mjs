import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: options.cwd || repoRoot,
    encoding: options.encoding ?? "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function untrackedFiles() {
  return git(["ls-files", "--others", "--exclude-standard", "-z"], { encoding: "buffer" })
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .sort();
}

function changedFiles() {
  const tracked = git(["diff", "--name-only", "HEAD", "--"])
    .split(/\r?\n/u)
    .filter(Boolean);
  return [...new Set([...tracked, ...untrackedFiles()])].sort();
}

function stagedFiles() {
  return git(["diff", "--cached", "--name-only", "HEAD", "--"])
    .split(/\r?\n/u)
    .filter(Boolean)
    .sort();
}

function stagedPatch() {
  return git(["diff", "--cached", "--binary", "HEAD", "--"], { encoding: "buffer" });
}

function commitFor(ref) {
  return git(["rev-parse", "--verify", `${ref}^{commit}`]).trim();
}

function changedFilesBetween(baseline, target) {
  return git(["diff", "--name-only", baseline, target, "--"])
    .split(/\r?\n/u)
    .filter(Boolean)
    .sort();
}

function fingerprint() {
  const head = git(["rev-parse", "HEAD"]).trim();
  const diff = git(["diff", "--binary", "HEAD", "--"], { encoding: "buffer" });
  const hash = createHash("sha256").update(head).update("\0").update(diff);
  const files = {};
  for (const path of untrackedFiles()) {
    const absolute = join(repoRoot, path);
    const bytes = readFileSync(absolute);
    files[path] = sha256(bytes);
    hash.update("\0").update(path).update("\0").update(bytes);
  }
  return { head, hash: hash.digest("hex"), files };
}

function stagedFingerprint() {
  const head = git(["rev-parse", "HEAD"]).trim();
  const diff = stagedPatch();
  return {
    head,
    hash: createHash("sha256").update(head).update("\0").update(diff).digest("hex"),
    files: {},
  };
}

export function parseArgs(argv) {
  const args = {
    baseline: "HEAD",
    baselineExplicit: false,
    build: true,
    fullTests: false,
    keepSnapshot: false,
    requireArchives: true,
    staged: false,
    label: "",
    reportRoot: "",
    snapshotRoot: "",
    target: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--baseline") {
      args.baseline = argv[++index];
      args.baselineExplicit = true;
    }
    else if (value === "--label") args.label = argv[++index];
    else if (value === "--report-root") args.reportRoot = argv[++index];
    else if (value === "--snapshot-root") args.snapshotRoot = argv[++index];
    else if (value === "--target") args.target = argv[++index];
    else if (value === "--no-build") args.build = false;
    else if (value === "--full-tests") args.fullTests = true;
    else if (value === "--keep-snapshot") args.keepSnapshot = true;
    else if (value === "--staged") args.staged = true;
    else if (value === "--allow-missing-archive") args.requireArchives = false;
    else if (value === "--help" || value === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  for (const [flag, field] of [
    ["--baseline", "baseline"],
    ["--label", "label"],
    ["--report-root", "reportRoot"],
    ["--snapshot-root", "snapshotRoot"],
    ["--target", "target"],
  ]) {
    if (argv.includes(flag) && !args[field]) throw new Error(`${flag} requires a value`);
  }
  if (args.target && args.staged) throw new Error("--staged cannot be combined with --target");
  return args;
}

export function effectiveBaselineRef(args) {
  if (args.target && !args.baselineExplicit) return `${args.target}^`;
  return args.baseline;
}

function usage() {
  return [
    "Usage: node research/automation/verify-frozen-correction.mjs [options]",
    "",
    "Freeze a dirty correction batch or an already-committed delta into a detached worktree and run verify-correction there.",
    "The source tree is never modified; generated verification artifacts are written under .work.",
    "",
    "Options:",
    "  --target <ref>            Verify an already-committed target instead of the dirty tree",
    "  --staged                  Verify only the Git index; ignore unrelated unstaged/untracked work",
    "  --baseline <ref>          Compare canonical data with this ref (dirty default: HEAD; target default: <target>^)",
    "  --label <name>            Human-readable report/snapshot suffix",
    "  --report-root <path>      Durable report directory in the source checkout",
    "  --snapshot-root <path>    Detached worktree path (default: .work/fv/<short-id>)",
    "  --no-build                Skip the production build inside verify-correction",
    "  --full-tests              Run pnpm test after correction verification succeeds",
    "  --allow-missing-archive   Permit new articles without a verified archive copy",
    "  --keep-snapshot           Keep the detached worktree after successful verification",
  ].join("\n");
}

function safeName(value) {
  return String(value || "")
    .replace(/[^a-z0-9._-]+/giu, "-")
    .replace(/^-+|-+$/gu, "") || "verification";
}

export function verificationIndexRelativePaths(summary) {
  const latest = join(".work", "correction-verifications", "latest.json");
  if (summary?.targetCommit) {
    return {
      latest,
      exact: join(".work", "correction-verifications", "by-target", `${summary.targetCommit}.json`),
    };
  }
  const head = safeName(summary?.sourceHead || "unknown-head");
  const fingerprint = safeName(String(summary?.sourceFingerprint || "unknown"));
  return {
    latest,
    exact: join(".work", "correction-verifications", "by-source", `${head}-${fingerprint}.json`),
  };
}

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    renameSync(temp, path);
    return { written: true, reusedExisting: false };
  } catch (error) {
    // Concurrent verifiers can legitimately finish the same immutable target
    // at nearly the same time. On Windows, replacing an existing destination
    // with rename can fail with EPERM. An already-published exact index is
    // sufficient because its filename is content-addressed by commit or source
    // fingerprint.
    if (existsSync(path)) {
      rmSync(temp, { force: true });
      JSON.parse(readFileSync(path, "utf8"));
      return { written: false, reusedExisting: true };
    }
    rmSync(temp, { force: true });
    throw error;
  }
}

function writeVerificationIndexes(summary, summaryPath) {
  const indexPaths = verificationIndexRelativePaths(summary);
  const envelope = {
    schemaVersion: 1,
    summaryPath: relative(repoRoot, summaryPath),
    ...summary,
  };
  const exactResult = writeJsonAtomic(resolve(repoRoot, indexPaths.exact), envelope);
  let latestWriteOk = true;
  let latestWriteError = "";
  try {
    writeJsonAtomic(resolve(repoRoot, indexPaths.latest), envelope);
  } catch (error) {
    // latest.json is a convenience pointer only. Exact indexes are the
    // authoritative recovery mechanism and must not be invalidated by a race.
    latestWriteOk = false;
    latestWriteError = String(error?.message || error);
  }
  return {
    ...indexPaths,
    exactReusedExisting: exactResult.reusedExisting,
    latestWriteOk,
    ...(latestWriteError ? { latestWriteError } : {}),
  };
}

function resolveInsideRepo(path, fallback) {
  const resolved = resolve(repoRoot, path || fallback);
  const rel = relative(repoRoot, resolved);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Path must be inside the repository: ${resolved}`);
  }
  return resolved;
}

function copyDirtyState(files, snapshotRoot) {
  for (const path of files) {
    const source = join(repoRoot, path);
    const target = join(snapshotRoot, path);
    if (!existsSync(source)) {
      rmSync(target, { force: true });
      continue;
    }
    if (!lstatSync(source).isFile()) throw new Error(`Unsupported changed path type: ${path}`);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target, { force: true, preserveTimestamps: true });
  }
}

function applyStagedState(snapshotRoot, patch) {
  execFileSync("git", ["apply", "--binary", "--whitespace=nowarn", "-"], {
    cwd: snapshotRoot,
    input: patch,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function run(command, args, { cwd, stdoutPath, stderrPath }) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: false,
    maxBuffer: 64 * 1024 * 1024,
  });
  writeFileSync(stdoutPath, result.stdout || "", "utf8");
  writeFileSync(stderrPath, result.stderr || "", "utf8");
  if (result.error) throw result.error;
  return result.status;
}

function pnpmCommand(args) {
  if (process.platform !== "win32") return { command: "pnpm", args };
  return {
    command: process.env.ComSpec || "cmd.exe",
    args: ["/d", "/s", "/c", `pnpm.cmd ${args.join(" ")}`],
  };
}

function removeSnapshot(snapshotRoot) {
  rmSync(join(snapshotRoot, "node_modules"), {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 100,
  });
  git(["worktree", "remove", "--force", snapshotRoot], { stdio: ["ignore", "ignore", "pipe"] });
  git(["worktree", "prune"], { stdio: ["ignore", "ignore", "pipe"] });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const committedMode = Boolean(args.target);
  const stagedMode = args.staged;
  const baselineRef = effectiveBaselineRef(args);
  const targetCommit = committedMode ? commitFor(args.target) : "";
  const baselineCommit = committedMode ? commitFor(baselineRef) : "";
  const files = committedMode
    ? changedFilesBetween(baselineCommit, targetCommit)
    : stagedMode
      ? stagedFiles()
      : changedFiles();
  if (!files.length) {
    if (committedMode) throw new Error(`No changed files between ${baselineRef} and ${args.target}`);
    if (stagedMode) throw new Error("Git index is clean; there is no staged correction batch to freeze");
    throw new Error("Working tree is clean; there is no correction batch to freeze");
  }

  const stamp = new Date().toISOString().replace(/[-:.TZ]/gu, "");
  const snapshotId = Date.now().toString(36);
  const suffix = args.label ? `-${safeName(args.label)}` : "";
  const snapshotRoot = resolveInsideRepo(
    args.snapshotRoot,
    join(".work", "fv", snapshotId),
  );
  const reportRoot = resolveInsideRepo(
    args.reportRoot,
    join(".work", "correction-verifications", `frozen-${stamp}${suffix}`),
  );
  if (existsSync(snapshotRoot)) throw new Error(`Snapshot path already exists: ${snapshotRoot}`);
  mkdirSync(reportRoot, { recursive: true });

  const startedAt = new Date().toISOString();
  const before = committedMode
    ? {
        head: targetCommit,
        hash: sha256(`commit\0${baselineCommit}\0${targetCommit}`),
        files: {},
      }
    : stagedMode
      ? stagedFingerprint()
      : fingerprint();
  const frozenStagedPatch = stagedMode ? stagedPatch() : null;
  const summary = {
    startedAt,
    verificationMode: committedMode ? "commit" : stagedMode ? "staged" : "dirty-tree",
    baseline: baselineRef,
    baselineCommit: committedMode ? baselineCommit : null,
    targetRef: committedMode ? args.target : null,
    targetCommit: committedMode ? targetCommit : null,
    sourceHead: before.head,
    sourceFingerprint: before.hash,
    changedFiles: files,
    snapshotRoot: relative(repoRoot, snapshotRoot),
    reportRoot: relative(repoRoot, reportRoot),
    sourceStable: false,
    verificationOk: false,
    fullTestsOk: args.fullTests ? false : null,
    snapshotRemoved: false,
  };
  const summaryPath = join(reportRoot, "frozen-summary.json");

  try {
    git(["worktree", "add", "--detach", snapshotRoot, committedMode ? targetCommit : "HEAD"], { stdio: ["ignore", "ignore", "pipe"] });
    if (committedMode) {
      summary.sourceStable = commitFor(targetCommit) === targetCommit && commitFor(baselineCommit) === baselineCommit;
    } else if (stagedMode) {
      applyStagedState(snapshotRoot, frozenStagedPatch);
      const afterCopy = stagedFingerprint();
      summary.sourceStable = afterCopy.head === before.head && afterCopy.hash === before.hash;
    } else {
      copyDirtyState(files, snapshotRoot);
      const afterCopy = fingerprint();
      summary.sourceStable = afterCopy.head === before.head && afterCopy.hash === before.hash;
    }
    if (!summary.sourceStable) throw new Error("Source changed while the frozen snapshot was being created");

    if (args.build || args.fullTests) {
      const install = pnpmCommand(["install", "--offline", "--frozen-lockfile"]);
      const dependencyExitCode = run(install.command, install.args, {
        cwd: snapshotRoot,
        stdoutPath: join(reportRoot, "dependencies.stdout.log"),
        stderrPath: join(reportRoot, "dependencies.stderr.log"),
      });
      summary.dependenciesExitCode = dependencyExitCode;
      summary.dependenciesPrepared = dependencyExitCode === 0;
      if (!summary.dependenciesPrepared) {
        throw new Error(`Frozen dependency preparation failed with exit code ${dependencyExitCode}`);
      }
    } else {
      summary.dependenciesPrepared = null;
    }

    const verifyArgs = [
      "research/automation/verify-correction.mjs",
      "--baseline", committedMode ? baselineCommit : baselineRef,
      "--report-root", reportRoot,
    ];
    if (!args.build) verifyArgs.push("--no-build");
    if (!args.requireArchives) verifyArgs.push("--allow-missing-archive");
    const verifyExitCode = run(process.execPath, verifyArgs, {
      cwd: snapshotRoot,
      stdoutPath: join(reportRoot, "verifier.stdout.log"),
      stderrPath: join(reportRoot, "verifier.stderr.log"),
    });
    summary.verifyExitCode = verifyExitCode;
    summary.verificationOk = verifyExitCode === 0;
    if (!summary.verificationOk) throw new Error(`Frozen correction verification failed with exit code ${verifyExitCode}`);

    if (args.fullTests) {
      const tests = pnpmCommand(["test"]);
      const testExitCode = run(tests.command, tests.args, {
        cwd: snapshotRoot,
        stdoutPath: join(reportRoot, "full-tests.stdout.log"),
        stderrPath: join(reportRoot, "full-tests.stderr.log"),
      });
      summary.fullTestsExitCode = testExitCode;
      summary.fullTestsOk = testExitCode === 0;
      if (!summary.fullTestsOk) throw new Error(`Frozen full test suite failed with exit code ${testExitCode}`);
    }

    if (committedMode) {
      summary.sourceStable = commitFor(targetCommit) === targetCommit && commitFor(baselineCommit) === baselineCommit;
    } else if (stagedMode) {
      const afterVerify = stagedFingerprint();
      summary.sourceStable = afterVerify.head === before.head && afterVerify.hash === before.hash;
    } else {
      const afterVerify = fingerprint();
      summary.sourceStable = afterVerify.head === before.head && afterVerify.hash === before.hash;
    }
    if (!summary.sourceStable) throw new Error("Source changed while the frozen snapshot was being verified");

    summary.ok = true;
    summary.finishedAt = new Date().toISOString();
    if (!args.keepSnapshot) {
      try {
        removeSnapshot(snapshotRoot);
        summary.snapshotRemoved = true;
      } catch (cleanupError) {
        summary.cleanupError = String(cleanupError?.message || cleanupError);
      }
    }
    summary.indexPaths = writeVerificationIndexes(summary, summaryPath);
    writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } catch (error) {
    summary.ok = false;
    summary.error = String(error?.message || error);
    summary.finishedAt = new Date().toISOString();
    summary.indexPaths = writeVerificationIndexes(summary, summaryPath);
    writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    process.stderr.write(`${summary.error}\nsummary=${summaryPath}\nsnapshot=${snapshotRoot}\n`);
    process.exitCode = 1;
  }
}

const directInvocation = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (directInvocation) await main();
