import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { readEvidenceSnapshot } from "./evidence-archive.mjs";

function git(repoRoot, args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

export function articleAtGitRef(articleId, ref = "HEAD", repoRoot = process.cwd()) {
  const id = String(articleId || "").trim();
  if (!id) throw new Error("article id is required");
  const root = resolve(repoRoot);
  const files = git(root, ["ls-tree", "-r", "--name-only", ref, "--", "data/news"])
    .split(/\r?\n/u)
    .filter((path) => path.endsWith(".jsonl"));
  for (const file of files) {
    const text = git(root, ["show", `${ref}:${file}`]);
    for (const line of text.split(/\r?\n/u)) {
      if (!line || !line.includes(id)) continue;
      const row = JSON.parse(line);
      if (row.id === id) return { file, article: row };
    }
  }
  return null;
}

export async function reconstructArticle(articleId, {
  ref = "HEAD",
  repoRoot = process.cwd(),
  archiveRoot,
  backupRoot,
} = {}) {
  const canonical = articleAtGitRef(articleId, ref, repoRoot);
  const evidence = await readEvidenceSnapshot(articleId, { archiveRoot, backupRoot });
  return {
    articleId,
    ref,
    canonical,
    evidence: {
      found: evidence.found,
      latestStatus: evidence.manifest?.latestStatus || "",
      latestCapture: evidence.manifest?.latestCapture || "",
      metadata: evidence.metadata,
    },
  };
}
