import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeJsonlRecordText } from "../lib/merge-jsonl.mjs";

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith("--")) throw new Error("unexpected argument: " + value);
    const key = value.slice(2);
    const next = argv[i + 1];
    if (next == null || next.startsWith("--")) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    i += 1;
  }
  return options;
}

function git(cwd, args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
  if (!allowFailure && result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "git failed: " + args.join(" ")).trim());
  }
  return {
    ok: result.status === 0,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
  };
}

function normalizedRoot(path) {
  return resolve(path).replaceAll("\\", "/").toLowerCase();
}

function stagedEntries(sourceRoot) {
  const text = git(sourceRoot, ["diff", "--cached", "--name-status", "--no-renames"]).stdout;
  return text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf("\t");
      if (tab < 0) throw new Error("could not parse staged path: " + line);
      return { status: line.slice(0, tab), path: line.slice(tab + 1) };
    });
}

function allowedPath(path) {
  return /^data\/(news|timeline)\/\d{4}-\d{2}\.jsonl$/u.test(path);
}

function gitBlob(cwd, spec, { allowMissing = false } = {}) {
  const result = git(cwd, ["show", spec], { allowFailure: allowMissing });
  if (!result.ok) return "";
  return result.stdout;
}

function targetText(targetRoot, path) {
  const absolute = resolve(targetRoot, path);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
}

function normalizeText(text) {
  return String(text || "").replace(/\r\n/gu, "\n");
}

function textMerge(baseText, stagedText, currentText) {
  const base = normalizeText(baseText);
  const staged = normalizeText(stagedText);
  const current = normalizeText(currentText);
  if (current === staged) return { ok: true, text: current, alreadyPresent: true };
  if (current !== base) return { ok: false, text: current, alreadyPresent: false };
  return { ok: true, text: staged, alreadyPresent: false };
}

export function refreshStagedAuditPacketPlan({
  sourceRoot,
  targetRoot,
  recordId,
  apply = false,
}) {
  if (!sourceRoot || !targetRoot || !recordId) {
    throw new Error("sourceRoot, targetRoot, and recordId are required");
  }
  const source = resolve(sourceRoot);
  const target = resolve(targetRoot);
  if (normalizedRoot(source) === normalizedRoot(target)) {
    throw new Error("source and target worktrees must differ");
  }
  git(source, ["rev-parse", "--show-toplevel"]);
  git(target, ["rev-parse", "--show-toplevel"]);

  const targetStatus = git(target, ["status", "--porcelain"]).stdout.trim();
  if (targetStatus) {
    return {
      sourceRoot: source,
      targetRoot: target,
      recordId,
      blocked: ["target-worktree-dirty"],
      canApply: false,
      applied: false,
    };
  }

  const entries = stagedEntries(source);
  if (!entries.length) {
    return {
      sourceRoot: source,
      targetRoot: target,
      recordId,
      files: [],
      blocked: ["source-has-no-staged-changes"],
      canApply: false,
      applied: false,
    };
  }
  const invalidFiles = entries.filter(({ path }) => !allowedPath(path)).map(({ path }) => path);
  const planned = [];
  const overlaps = [];
  const timelineChangedIds = new Set();
  const allChangedIds = new Set();

  for (const entry of entries) {
    const { path, status } = entry;
    if (!["A", "M", "D"].includes(status)) {
      planned.push({ ...entry, ok: false, reason: "unsupported-staged-status" });
      continue;
    }
    const baseText = status === "A" ? "" : gitBlob(source, "HEAD:" + path);
    const stagedText = status === "D" ? "" : gitBlob(source, ":" + path);
    const currentText = targetText(target, path);

    if (path.endsWith(".jsonl")) {
      const merged = mergeJsonlRecordText(baseText, stagedText, currentText);
      for (const id of merged.changedIds || []) {
        allChangedIds.add(id);
        if (path.startsWith("data/timeline/")) timelineChangedIds.add(id);
      }
      for (const id of merged.overlapIds || []) overlaps.push({ path, id });
      planned.push({
        ...entry,
        ok: merged.ok,
        changedIds: merged.changedIds || [],
        overlapIds: merged.overlapIds || [],
        text: merged.text,
      });
      continue;
    }

    const merged = textMerge(baseText, stagedText, currentText);
    if (!merged.ok) overlaps.push({ path, id: null });
    planned.push({
      ...entry,
      ok: merged.ok,
      changedIds: [],
      overlapIds: [],
      alreadyPresent: merged.alreadyPresent,
      text: merged.text,
    });
  }

  const blocked = [];
  if (invalidFiles.length) blocked.push("invalid-staged-paths");
  if (planned.some((item) => !item.ok)) blocked.push("target-overlap");
  if (!timelineChangedIds.has(recordId)) blocked.push("claimed-record-not-changed");
  const extraTimelineIds = [...timelineChangedIds].filter((id) => id !== recordId).sort();
  if (extraTimelineIds.length) blocked.push("extra-timeline-records");

  const result = {
    sourceRoot: source,
    targetRoot: target,
    recordId,
    files: entries.map(({ path, status }) => ({ path, status })),
    invalidFiles,
    changedIds: [...allChangedIds].sort(),
    timelineChangedIds: [...timelineChangedIds].sort(),
    extraTimelineIds,
    overlaps,
    blocked,
    canApply: blocked.length === 0,
    applied: false,
  };
  if (!apply || blocked.length) return result;

  for (const item of planned) {
    const absolute = resolve(target, item.path);
    if (item.status === "D" && item.text === "") {
      git(target, ["rm", "--", item.path]);
      continue;
    }
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, item.text, "utf8");
    git(target, ["add", "--", item.path]);
  }
  return { ...result, applied: true };
}

function help() {
  process.stdout.write([
    "Refresh a staged audit packet from a stale worktree onto a clean current worktree.",
    "",
    "node research/automation/refresh-staged-audit-packet.mjs --source <worktree> --target <worktree> --record <id> [--apply]",
    "",
    "Preview is the default. --apply writes and stages only approved data JSONL files.",
  ].join("\n") + "\n");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || options.h) {
    help();
    return;
  }
  const result = refreshStagedAuditPacketPlan({
    sourceRoot: options.source,
    targetRoot: options.target,
    recordId: options.record,
    apply: Boolean(options.apply),
  });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (result.blocked.length) process.exitCode = 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) main();
