import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { reconstructArticle } from "../research/lib/reconstruct.mjs";
import { storeEvidenceAttempt } from "../research/lib/evidence-archive.mjs";

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true }).trim();
}

test("historical reconstruction joins the Git revision and private archive by stable article ID", async () => {
  const root = await mkdtemp(join(tmpdir(), "borderclash-reconstruct-"));
  const archiveRoot = join(root, "archive");
  const backupRoot = join(root, "backup");
  try {
    await mkdir(join(root, "data", "news"), { recursive: true });
    const article = {
      id: "historical-article-001",
      source: "Fixture News",
      sourceUrl: "https://example.com/archive/1",
      title: "Original title",
      fetchedAt: Date.UTC(2026, 10, 13),
      publishedAt: Date.UTC(2026, 10, 12),
      category: "diplomatic",
      mediaEnvironment: "international",
      status: "archived",
      credibility: 70,
    };
    const newsPath = join(root, "data", "news", "2026-11.jsonl");
    await writeFile(newsPath, JSON.stringify(article) + "\n", "utf8");
    git(root, ["init", "--quiet"]);
    git(root, ["config", "user.name", "Fixture"]);
    git(root, ["config", "user.email", "fixture@example.invalid"]);
    git(root, ["add", "data/news/2026-11.jsonl"]);
    git(root, ["commit", "--quiet", "-m", "historical base"]);
    const historicalRef = git(root, ["rev-parse", "HEAD"]);

    const sourceBody = Buffer.from("<html><body><article>Archived source body with enough context for reconstruction.</article></body></html>");
    await storeEvidenceAttempt(article.id, {
      status: "captured-html",
      requestedUrl: article.sourceUrl,
      finalUrl: article.sourceUrl,
      canonicalUrl: article.sourceUrl,
      contentType: "text/html",
      body: sourceBody,
      text: "Archived source body with enough context for reconstruction.",
      sha256: createHash("sha256").update(sourceBody).digest("hex"),
      byteLength: sourceBody.length,
      redirectChain: [],
    }, { archiveRoot, backupRoot, now: Date.UTC(2026, 10, 13, 1) });

    await writeFile(newsPath, JSON.stringify({ ...article, title: "Later corrected title" }) + "\n", "utf8");
    git(root, ["add", "data/news/2026-11.jsonl"]);
    git(root, ["commit", "--quiet", "-m", "later edit"]);

    const result = await reconstructArticle(article.id, {
      ref: historicalRef,
      repoRoot: root,
      archiveRoot,
      backupRoot,
    });
    assert.equal(result.canonical.file, "data/news/2026-11.jsonl");
    assert.equal(result.canonical.article.title, "Original title");
    assert.equal(result.evidence.found, true);
    assert.equal(result.evidence.latestStatus, "captured-html");
    assert.equal(result.evidence.metadata.articleId, article.id);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
