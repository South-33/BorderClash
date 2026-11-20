import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildAuditPreparation } from "../research/lib/audit-prepare.mjs";

async function writeCapture(root, id, text, status = "captured-html") {
  const key = `capture-${id}`;
  const articleRoot = join(root, id);
  const captureRoot = join(articleRoot, "captures", key);
  await mkdir(captureRoot, { recursive: true });
  await writeFile(join(articleRoot, "manifest.json"), JSON.stringify({ latestCapture: key, latestStatus: status }), "utf8");
  const storedText = status === "captured-html" && text.length < 300 ? `${text}\n${"x".repeat(300)}` : text;
  await writeFile(join(captureRoot, "text.txt"), storedText, "utf8");
}

async function writeStatus(root, id, status) {
  const articleRoot = join(root, id);
  await mkdir(articleRoot, { recursive: true });
  await writeFile(join(articleRoot, "manifest.json"), JSON.stringify({ latestCapture: "", latestStatus: status }), "utf8");
}

const timeline = [
  {
    id: "target",
    date: "2026-06-02",
    category: "diplomatic",
    importance: 90,
    title: "Cambodia Starts Maritime Conciliation",
    description: "Cambodia starts compulsory maritime conciliation.",
    evidenceIds: ["a", "blocked"],
  },
  {
    id: "duplicate",
    date: "2026-06-01",
    category: "diplomatic",
    importance: 80,
    title: "Cambodia Launches Maritime Conciliation",
    description: "Cambodia launches compulsory maritime conciliation.",
    evidenceIds: ["b"],
  },
];

const articles = [
  { id: "a", source: "Source A", sourceUrl: "https://example.test/a", publishedAt: Date.UTC(2026, 5, 2), title: "A", provenanceId: "wire-a" },
  { id: "b", source: "Source B", sourceUrl: "https://example.test/b", publishedAt: Date.UTC(2026, 5, 2), title: "B", provenanceId: "wire-a" },
  { id: "blocked", source: "Blocked", sourceUrl: "https://example.test/blocked", publishedAt: Date.UTC(2026, 5, 2), title: "Blocked" },
];

test("audit preparation combines duplicate-cluster and capture state in one compact packet", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-prepare-"));
  await writeCapture(archiveRoot, "a", "publisher text for A");
  await writeStatus(archiveRoot, "blocked", "access-blocked");
  const captureCalls = [];

  const result = await buildAuditPreparation({
    id: "target",
    timeline,
    articles,
    windowDays: 3,
    limit: 5,
    archiveRoot,
    retryMissing: true,
    captureArticleFn: async (article) => {
      captureCalls.push(article.id);
      await writeCapture(archiveRoot, article.id, `captured ${article.id}`);
      return { status: "captured-html" };
    },
  });

  assert.equal(result.recordCount, 2);
  assert.equal(result.candidateCount, 1);
  assert.deepEqual(captureCalls, ["b"]);
  assert.equal(result.captureSummary.capturedCount, 2);
  assert.equal(result.captureSummary.missingCount, 1);
  assert.equal(result.captureSummary.skippedPersistentCount, 1);
  assert.equal(result.skippedPersistent[0].articleId, "blocked");
  assert.equal(result.captureAttempts[0].usable, true);
  assert.deepEqual(result.sharedProvenance, [{ provenanceId: "wire-a", count: 2 }]);
  assert.equal(result.records[0].role, "target");
  assert.equal(result.records[1].id, "duplicate");
  assert.match(result.records[1].evidence[0].capturePreview, /captured b/u);
});

test("audit preparation can force retry persistent capture failures", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-prepare-force-"));
  await writeStatus(archiveRoot, "a", "access-blocked");
  await writeStatus(archiveRoot, "b", "access-blocked");
  await writeStatus(archiveRoot, "blocked", "access-blocked");
  const captureCalls = [];

  await buildAuditPreparation({
    id: "target",
    timeline,
    articles,
    archiveRoot,
    retryMissing: true,
    forceCapture: true,
    captureArticleFn: async (article) => {
      captureCalls.push(article.id);
      await writeCapture(archiveRoot, article.id, `forced ${article.id}`);
      return { status: "captured-html" };
    },
  });

  assert.deepEqual(new Set(captureCalls), new Set(["a", "b", "blocked"]));
});
