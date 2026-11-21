import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeArticleUrl } from "../lib/articles.mjs";

function run(command, args, { cwd, encoding = "utf8" } = {}) {
  return spawnSync(command, args, {
    cwd,
    encoding,
    windowsHide: true,
  });
}

function lines(value) {
  return String(value || "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizePath(path) {
  return String(path || "").replaceAll("\\", "/");
}

function relevantAuditPath(path) {
  const normalized = normalizePath(path);
  return normalized.startsWith("data/");
}

function gitLines(cwd, args) {
  const result = run("git", args, { cwd });
  if (result.status !== 0) {
    throw new Error(String(result.stderr || result.stdout || "git failed").trim());
  }
  return lines(result.stdout).map(normalizePath);
}

function stableArticleId(sourceUrl) {
  const identity = normalizeArticleUrl(sourceUrl);
  return createHash("sha256").update(identity).digest("hex").slice(0, 32);
}

function gitText(cwd, args, { allowMissing = false } = {}) {
  const result = run("git", args, { cwd });
  if (result.status === 0) return String(result.stdout || "");
  if (allowMissing && result.status === 128) return "";
  throw new Error(String(result.stderr || result.stdout || "git failed").trim());
}

function parseJsonl(text) {
  return String(text || "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function stagedNewArticleIdentityIssues(cwd, stagedPaths) {
  const issues = [];
  for (const path of stagedPaths.filter((value) => /^data\/news\/.*\.jsonl$/u.test(value))) {
    const beforeRows = parseJsonl(gitText(cwd, ["show", `HEAD:${path}`], { allowMissing: true }));
    const stagedRows = parseJsonl(gitText(cwd, ["show", `:${path}`]));
    const beforeIds = new Set(beforeRows.map((row) => row?.id).filter(Boolean));

    for (const row of stagedRows) {
      if (!row?.id || beforeIds.has(row.id) || !row.sourceUrl) continue;
      const expectedId = stableArticleId(row.sourceUrl);
      if (row.id === expectedId) continue;
      issues.push({
        path,
        articleId: row.id,
        expectedId,
        sourceUrl: row.sourceUrl,
      });
    }
  }
  return issues;
}

export function auditPreflight({ cwd = process.cwd() } = {}) {
  const repoRoot = run("git", ["rev-parse", "--show-toplevel"], { cwd });
  if (repoRoot.status !== 0) {
    return {
      ok: false,
      reason: "not-a-git-worktree",
      error: String(repoRoot.stderr || repoRoot.stdout || "git rev-parse failed").trim(),
    };
  }
  const root = String(repoRoot.stdout || "").trim();
  const staged = gitLines(root, ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "--"]);
  const unstagedRelevant = gitLines(root, ["diff", "--name-only", "--"])
    .filter(relevantAuditPath);
  const untrackedRelevant = gitLines(root, ["ls-files", "--others", "--exclude-standard"])
    .filter(relevantAuditPath);

  if (!staged.length) {
    return {
      ok: false,
      reason: "no-staged-changes",
      staged,
      unstagedRelevant,
      untrackedRelevant,
    };
  }
  if (unstagedRelevant.length || untrackedRelevant.length) {
    return {
      ok: false,
      reason: "audit-files-not-staged",
      staged,
      unstagedRelevant,
      untrackedRelevant,
    };
  }

  const whitespace = run("git", ["diff", "--cached", "--check"], { cwd: root });
  if (whitespace.status !== 0) {
    return {
      ok: false,
      reason: "staged-diff-check-failed",
      staged,
      output: String(whitespace.stdout || whitespace.stderr || "").trim(),
    };
  }

  const articleIdentityIssues = stagedNewArticleIdentityIssues(root, staged);
  if (articleIdentityIssues.length) {
    return {
      ok: false,
      reason: "noncanonical-new-article-id",
      staged,
      articleIdentityIssues,
    };
  }

  const validateStarted = Date.now();
  const validate = run(process.execPath, ["research/validate.mjs"], { cwd: root });
  const validateMs = Date.now() - validateStarted;
  if (validate.status !== 0) {
    return {
      ok: false,
      reason: "validation-failed",
      staged,
      validateMs,
      output: String(validate.stdout || validate.stderr || "").trim(),
    };
  }

  return {
    ok: true,
    repoRoot: normalizePath(root),
    staged,
    validateMs,
  };
}

function isMain() {
  if (!process.argv[1]) return false;
  return resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
}

if (isMain()) {
  const result = auditPreflight();
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (!result.ok) process.exitCode = 1;
}
