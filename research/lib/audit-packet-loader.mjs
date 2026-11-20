import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { loadArticleRegistry } from "./article-ingest.mjs";
import { buildAuditPacket } from "./audit-packet.mjs";
import { listFiles, readJson, readJsonl } from "./files.mjs";

function git(cwd, args, { allowFailure = false } = {}) {
  const result = spawnSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status === 0) return String(result.stdout || "").trim();
  if (allowFailure) return "";
  throw new Error(String(result.stderr || result.stdout || "git failed").trim());
}

function parseJsonlText(text) {
  return String(text || "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function changedTimelinePaths(cwd, args) {
  return git(cwd, args, { allowFailure: true })
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter((value) => /^data\/timeline\/.*\.jsonl$/u.test(value));
}

function recordFromGitRef(cwd, ref, path, id) {
  const text = git(cwd, ["show", `${ref}:${path}`], { allowFailure: true });
  if (!text) return null;
  return parseJsonlText(text).find((record) => record.id === id) || null;
}

export function deletedTimelineRecordFromGit(id, { cwd = process.cwd() } = {}) {
  if (!id) return null;

  const stagedPaths = changedTimelinePaths(cwd, [
    "diff",
    "--cached",
    "--name-only",
    "--",
    "data/timeline",
  ]);
  for (const path of stagedPaths) {
    const record = recordFromGitRef(cwd, "HEAD", path, id);
    if (record) return record;
  }

  const deletionCommit = git(cwd, [
    "log",
    "-1",
    "--format=%H",
    `-S${id}`,
    "--",
    "data/timeline",
  ], { allowFailure: true });
  if (!deletionCommit) return null;
  const parent = git(cwd, ["rev-parse", "--verify", `${deletionCommit}^`], { allowFailure: true });
  if (!parent) return null;

  const committedPaths = changedTimelinePaths(cwd, [
    "diff",
    "--name-only",
    parent,
    deletionCommit,
    "--",
    "data/timeline",
  ]);
  for (const path of committedPaths) {
    const before = recordFromGitRef(cwd, parent, path, id);
    const after = recordFromGitRef(cwd, deletionCommit, path, id);
    if (before && !after) return before;
  }

  return null;
}

export async function loadAuditPacketFromWorktree(id, {
  cwd = process.cwd(),
  dataRoot = join(cwd, "data"),
} = {}) {
  const registry = await loadArticleRegistry(dataRoot);
  const timeline = [];
  for (const file of await listFiles(join(dataRoot, "timeline"), ".jsonl")) {
    timeline.push(...await readJsonl(file));
  }
  const current = {};
  for (const name of ["summary", "thailand", "cambodia", "impact"]) {
    current[name] = await readJson(join(dataRoot, "current", `${name}.json`));
  }

  try {
    return buildAuditPacket({
      id,
      articles: registry.articles,
      timeline,
      current,
    });
  } catch (error) {
    if (!/unknown audit record id/u.test(String(error?.message || error))) throw error;
    const deletedRecord = deletedTimelineRecordFromGit(id, { cwd });
    if (!deletedRecord) throw error;
    return buildAuditPacket({
      id,
      articles: registry.articles,
      timeline,
      current,
      deletedRecord,
    });
  }
}
