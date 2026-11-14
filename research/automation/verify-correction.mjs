import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeArticleUrl } from "../lib/articles.mjs";
import { loadArticleRegistry } from "../lib/article-ingest.mjs";
import { verifyArchiveCopy } from "../lib/evidence-archive.mjs";
import { listFiles, readJson, readJsonl } from "../lib/files.mjs";
import { auditReferenceCoverage } from "../lib/reference-audit.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: options.encoding ?? "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  });
}

function tryGit(args) {
  try {
    return git(args);
  } catch (error) {
    if (error?.status === 128) return "";
    throw error;
  }
}

function parseArgs(argv) {
  const args = { baseline: "HEAD", build: true, requireArchives: true, reportRoot: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--baseline") args.baseline = argv[++index];
    else if (value === "--report-root") args.reportRoot = argv[++index];
    else if (value === "--no-build") args.build = false;
    else if (value === "--allow-missing-archive") args.requireArchives = false;
    else if (value === "--help" || value === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!args.baseline && !args.help) throw new Error("--baseline requires a Git ref");
  return args;
}

function parseJsonlText(text, source = "jsonl") {
  if (!String(text || "").trim()) return [];
  return String(text)
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${source}:${index + 1}: ${error.message}`);
      }
    });
}

export function diffRecords(beforeRows, afterRows) {
  const before = new Map(beforeRows.map((row) => [row.id, row]));
  const after = new Map(afterRows.map((row) => [row.id, row]));
  const added = [];
  const modified = [];
  const deleted = [];

  for (const [id, row] of after) {
    if (!before.has(id)) added.push(row);
    else if (JSON.stringify(before.get(id)) !== JSON.stringify(row)) {
      modified.push({ id, before: before.get(id), after: row });
    }
  }
  for (const [id, row] of before) if (!after.has(id)) deleted.push(row);
  return { added, modified, deleted };
}

export function stableArticleId(sourceUrl) {
  const identity = normalizeArticleUrl(sourceUrl);
  return createHash("sha256").update(identity).digest("hex").slice(0, 32);
}

function untrackedFiles() {
  const raw = git(["ls-files", "--others", "--exclude-standard", "-z"], { encoding: "buffer" });
  return raw
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .sort();
}

function changedWorktreeFiles() {
  const tracked = git(["diff", "--name-only", "HEAD", "--"])
    .split(/\r?\n/u)
    .filter(Boolean);
  return [...new Set([...tracked, ...untrackedFiles()])].sort();
}

function changedFileHashes() {
  const files = {};
  for (const path of changedWorktreeFiles()) {
    const absolute = join(repoRoot, path);
    files[path] = existsSync(absolute) ? sha256(readFileSync(absolute)) : "<deleted>";
  }
  return files;
}

function worktreeFingerprint() {
  const head = git(["rev-parse", "HEAD"]).trim();
  const diff = git(["diff", "--binary", "HEAD", "--"], { encoding: "buffer" });
  const hash = createHash("sha256").update(head).update("\0").update(diff);
  for (const path of untrackedFiles()) {
    hash.update("\0").update(path).update("\0");
    const absolute = join(repoRoot, path);
    if (existsSync(absolute)) hash.update(readFileSync(absolute));
  }
  return { head, hash: hash.digest("hex"), files: changedFileHashes() };
}

function changedPaths(before, after) {
  const paths = new Set([...Object.keys(before.files || {}), ...Object.keys(after.files || {})]);
  return [...paths].filter((path) => before.files?.[path] !== after.files?.[path]).sort();
}

function changedDataFiles(baseline) {
  const tracked = git(["diff", "--name-only", baseline, "--", "data"])
    .split(/\r?\n/u)
    .filter((path) => path.endsWith(".jsonl") || path.endsWith(".json"));
  const untracked = untrackedFiles().filter((path) =>
    path.startsWith("data/") && (path.endsWith(".jsonl") || path.endsWith(".json"))
  );
  return [...new Set([...tracked, ...untracked])].sort();
}

function baselineFile(ref, path) {
  return tryGit(["show", `${ref}:${path.replaceAll("\\", "/")}`]);
}

function jsonRecordId(path) {
  const normalized = path.replaceAll("\\", "/");
  if (normalized.startsWith("data/current/") && normalized.endsWith(".json")) {
    return `current/${normalized.slice("data/current/".length, -".json".length)}`;
  }
  if (normalized === "data/research-state.json") return "research-state";
  return normalized;
}

function diffJsonDocument(path, beforeText, afterText) {
  const id = jsonRecordId(path);
  const before = String(beforeText || "").trim() ? JSON.parse(beforeText) : null;
  const after = String(afterText || "").trim() ? JSON.parse(afterText) : null;
  if (before == null && after != null) return { added: [{ id, ...after }], modified: [], deleted: [] };
  if (before != null && after == null) return { added: [], modified: [], deleted: [{ id, ...before }] };
  if (JSON.stringify(before) === JSON.stringify(after)) return { added: [], modified: [], deleted: [] };
  return { added: [], modified: [{ id, before, after }], deleted: [] };
}

function analyzeChanges(baseline) {
  const files = [];
  const addedArticles = [];
  for (const path of changedDataFiles(baseline)) {
    const absolute = join(repoRoot, path);
    const beforeText = baselineFile(baseline, path);
    const afterText = existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
    const changes = path.endsWith(".jsonl")
      ? diffRecords(parseJsonlText(beforeText, `${baseline}:${path}`), parseJsonlText(afterText, path))
      : diffJsonDocument(path, beforeText, afterText);
    files.push({ path, ...changes });
    if (path.startsWith("data/news/")) addedArticles.push(...changes.added.map((row) => ({ path, row })));
  }
  return { files, addedArticles };
}

async function verifyAddedArticles(addedArticles, { requireArchives }) {
  const results = [];
  for (const { path, row } of addedArticles) {
    const expectedId = stableArticleId(row.sourceUrl);
    const identityOk = row.id === expectedId;
    let archive = null;
    let archiveError = "";
    try {
      archive = await verifyArchiveCopy(row.id);
    } catch (error) {
      archiveError = String(error?.message || error);
    }
    const archiveOk = Boolean(archive?.ok);
    results.push({
      path,
      articleId: row.id,
      sourceUrl: row.sourceUrl,
      expectedId,
      identityOk,
      archiveOk,
      archiveFiles: archive?.files ?? 0,
      archiveMismatches: archive?.mismatches ?? [],
      archiveError,
    });
    if (!identityOk) throw new Error(`New article ${row.id} does not match canonical URL identity ${expectedId}`);
    if (requireArchives && !archiveOk) {
      throw new Error(`New article ${row.id} does not have a verified archive/backup copy: ${archiveError || "mismatch"}`);
    }
  }
  return results;
}

async function verifyReferenceIntegrity() {
  const dataRoot = join(repoRoot, "data");
  const registry = await loadArticleRegistry(dataRoot);
  const timeline = [];
  for (const file of await listFiles(join(dataRoot, "timeline"), ".jsonl")) {
    timeline.push(...await readJsonl(file));
  }
  const current = {};
  for (const name of ["summary", "thailand", "cambodia", "impact"]) {
    current[name] = await readJson(join(dataRoot, "current", `${name}.json`));
  }
  const coverage = auditReferenceCoverage({ articles: registry.articles, timeline, current });
  if (coverage.missingTimelineEvidenceIds.length || coverage.missingCurrentEvidenceIds.length) {
    throw new Error(
      `Canonical evidence references are incomplete: timeline=${coverage.missingTimelineEvidenceIds.length} current=${coverage.missingCurrentEvidenceIds.length}`,
    );
  }
  return coverage;
}

function safeName(value) {
  return value.replace(/[^a-z0-9._-]+/giu, "-").replace(/^-+|-+$/gu, "") || "step";
}

function runStep(step, reportDir, expectedFingerprint) {
  const stdoutPath = join(reportDir, `${safeName(step.name)}.stdout.log`);
  const stderrPath = join(reportDir, `${safeName(step.name)}.stderr.log`);
  const startedAt = new Date().toISOString();
  const attempts = [];
  const maxAttempts = step.retryConcurrentBuild ? 25 : 1;
  let result;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    result = spawnSync(step.command, step.args, {
      cwd: repoRoot,
      encoding: "utf8",
      shell: step.shell ?? false,
      maxBuffer: 32 * 1024 * 1024,
    });
    attempts.push({
      attempt,
      exitCode: result.status,
      stdout: result.stdout || "",
      stderr: result.stderr || "",
    });
    if (result.status === 0) break;
    const output = `${result.stdout || ""}\n${result.stderr || ""}`;
    const concurrentBuild = /Another next build process is already running/iu.test(output);
    if (!step.retryConcurrentBuild || !concurrentBuild || attempt === maxAttempts) break;
    const waitingFingerprint = worktreeFingerprint();
    if (waitingFingerprint.hash !== expectedFingerprint.hash || waitingFingerprint.head !== expectedFingerprint.head) {
      throw new Error(`Working tree changed while waiting for concurrent build before '${step.name}'`);
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5_000);
  }
  writeFileSync(
    stdoutPath,
    attempts.map(({ attempt, stdout }) => `=== attempt ${attempt} ===\n${stdout}`).join("\n"),
    "utf8",
  );
  writeFileSync(
    stderrPath,
    attempts.map(({ attempt, stderr }) => `=== attempt ${attempt} ===\n${stderr}`).join("\n"),
    "utf8",
  );
  const fingerprint = worktreeFingerprint();
  const changedDuringStep = changedPaths(expectedFingerprint, fingerprint);
  const record = {
    name: step.name,
    command: [step.command, ...step.args].join(" "),
    startedAt,
    finishedAt: new Date().toISOString(),
    exitCode: result.status,
    stdoutPath: relative(repoRoot, stdoutPath),
    stderrPath: relative(repoRoot, stderrPath),
    snapshotStable: fingerprint.hash === expectedFingerprint.hash && fingerprint.head === expectedFingerprint.head,
    changedDuringStep,
    attempts: attempts.length,
  };
  if (result.error) throw result.error;
  if (!record.snapshotStable) {
    const suffix = changedDuringStep.length ? `: ${changedDuringStep.join(", ")}` : "";
    const error = new Error(`Working tree changed while running verification step '${step.name}'${suffix}`);
    error.stepRecord = record;
    throw error;
  }
  if (result.status !== 0) throw new Error(`Verification step '${step.name}' failed with exit code ${result.status}`);
  return record;
}

function usage() {
  return [
    "Usage: node research/automation/verify-correction.mjs [options]",
    "",
    "Options:",
    "  --baseline <ref>          Compare canonical data with this ref (default: HEAD)",
    "  --report-root <path>      Durable report directory (default: .work/correction-verifications/<timestamp>)",
    "  --no-build                Skip the production build",
    "  --allow-missing-archive   Do not fail when a newly added article lacks a verified archive copy",
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const baselineHead = git(["rev-parse", args.baseline]).trim();
  const stamp = new Date().toISOString().replace(/[-:.TZ]/gu, "");
  const reportDir = resolve(repoRoot, args.reportRoot || join(".work", "correction-verifications", stamp));
  mkdirSync(reportDir, { recursive: true });
  const initialFingerprint = worktreeFingerprint();
  const analysis = analyzeChanges(args.baseline);
  const report = {
    startedAt: new Date().toISOString(),
    baseline: args.baseline,
    baselineHead,
    head: initialFingerprint.head,
    worktreeFingerprint: initialFingerprint.hash,
    reportDir: relative(repoRoot, reportDir),
    changedFiles: analysis.files.map(({ path, added, modified, deleted }) => ({
      path,
      addedIds: added.map((row) => row.id),
      modifiedIds: modified.map((change) => change.id),
      deletedIds: deleted.map((row) => row.id),
    })),
    addedArticles: [],
    referenceCoverage: null,
    steps: [],
    ok: false,
  };
  const reportPath = join(reportDir, "report.json");

  try {
    report.addedArticles = await verifyAddedArticles(analysis.addedArticles, args);
    report.referenceCoverage = await verifyReferenceIntegrity();
    const afterEvidence = worktreeFingerprint();
    if (afterEvidence.hash !== initialFingerprint.hash || afterEvidence.head !== initialFingerprint.head) {
      throw new Error("Working tree changed while verifying article identity/archive evidence");
    }

    const node = process.execPath;
    const steps = [
      { name: "known-corrections", command: node, args: ["--test", "tests/known-corrections.test.mjs"] },
      { name: "validate", command: node, args: ["research/validate.mjs"] },
      { name: "audit-chronology", command: node, args: ["research/cli.mjs", "audit-chronology"] },
      { name: "audit-humanitarian", command: node, args: ["research/cli.mjs", "audit-humanitarian"] },
      { name: "audit-references", command: node, args: ["research/cli.mjs", "audit-references"] },
      { name: "diff-check", command: "git", args: ["diff", "--check", args.baseline, "--"] },
    ];
    if (args.build) {
      steps.push(process.platform === "win32"
        ? {
            name: "production-build",
            command: process.env.ComSpec || "cmd.exe",
            args: ["/d", "/s", "/c", "pnpm.cmd build"],
            retryConcurrentBuild: true,
          }
        : { name: "production-build", command: "pnpm", args: ["build"], retryConcurrentBuild: true });
    }
    for (const step of steps) report.steps.push(runStep(step, reportDir, initialFingerprint));

    report.ok = true;
    report.finishedAt = new Date().toISOString();
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    if (error?.stepRecord) report.steps.push(error.stepRecord);
    report.error = String(error?.message || error);
    report.finishedAt = new Date().toISOString();
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.stderr.write(`${report.error}\nreport=${reportPath}\n`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) await main();
