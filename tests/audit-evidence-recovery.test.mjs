import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { recoverAuditEvidence } from "../research/lib/audit-evidence-recovery.mjs";

async function writeCapture(root, id, text, status = "captured-html") {
  const key = `capture-${id}`;
  const articleRoot = join(root, id);
  const captureRoot = join(articleRoot, "captures", key);
  await mkdir(captureRoot, { recursive: true });
  await writeFile(join(articleRoot, "manifest.json"), JSON.stringify({ latestCapture: key, latestStatus: status }), "utf8");
  const storedText = status === "captured-html" && text.length < 300 ? `${text}\n${"x".repeat(300)}` : text;
  await writeFile(join(captureRoot, "text.txt"), storedText, "utf8");
}

async function writeLegacyShortHtml(root, id, text) {
  const key = `capture-${id}`;
  const articleRoot = join(root, id);
  const captureRoot = join(articleRoot, "captures", key);
  await mkdir(captureRoot, { recursive: true });
  await writeFile(join(articleRoot, "manifest.json"), JSON.stringify({ latestCapture: key, latestStatus: "captured-html" }), "utf8");
  await writeFile(join(captureRoot, "text.txt"), text, "utf8");
}

async function writeStatus(root, id, status) {
  const articleRoot = join(root, id);
  await mkdir(articleRoot, { recursive: true });
  await writeFile(join(articleRoot, "manifest.json"), JSON.stringify({ latestCapture: "", latestStatus: status }), "utf8");
}

const target = {
  id: "target",
  date: "2026-07-02",
  category: "diplomatic",
  title: "ASEAN Delegation Inspects Disputed Trat Border Infrastructure",
  description: "ASEAN delegation inspects disputed Trat border infrastructure and military construction.",
  evidenceIds: ["blocked-cited"],
};

const articles = [
  { id: "blocked-cited", source: "Blocked", sourceUrl: "https://example.test/cited", publishedAt: Date.UTC(2026, 6, 2), category: "diplomatic", title: "Military leads border inspection" },
  { id: "lead-a", source: "Lead A", sourceUrl: "https://example.test/a", publishedAt: Date.UTC(2026, 6, 2), category: "diplomatic", title: "ASEAN Delegation Inspects Trat Border Infrastructure", summary: "ASEAN delegation inspects disputed Trat border infrastructure and military construction." },
  { id: "lead-b", source: "Lead B", sourceUrl: "https://example.test/b", publishedAt: Date.UTC(2026, 6, 2), category: "diplomatic", title: "ASEAN Delegation Inspects Trat Border Facilities", summary: "ASEAN delegation inspects disputed Trat border infrastructure and military construction." },
  { id: "lead-c", source: "Lead C", sourceUrl: "https://example.test/c", publishedAt: Date.UTC(2026, 6, 2), category: "diplomatic", title: "ASEAN Delegation Inspects Trat Border Area", summary: "ASEAN delegation inspects disputed Trat border infrastructure and military construction." },
];

test("audit evidence recovery tries ranked leads until the first usable capture", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-recover-"));
  await writeStatus(archiveRoot, "blocked-cited", "access-blocked");
  const calls = [];
  const result = await recoverAuditEvidence({
    id: "target",
    timeline: [target],
    articles,
    archiveRoot,
    maxAttempts: 3,
    captureArticleFn: async (article) => {
      calls.push(article.id);
      if (article.id === "lead-a") return { status: "transient-failure" };
      await writeCapture(archiveRoot, article.id, `captured ${article.id}`);
      return { status: "captured-html" };
    },
  });

  assert.deepEqual(calls, ["lead-a", "lead-b"]);
  assert.equal(result.recoveryState, "captured-lead");
  assert.equal(result.selectedLead.id, "lead-b");
  assert.equal(result.attemptedCount, 2);
  assert.equal(result.diagnosis.nextAction, "review-existing-leads");
});

test("audit evidence recovery retries cited evidence before replacement leads", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-recover-cited-first-"));
  const calls = [];
  const result = await recoverAuditEvidence({
    id: "target",
    timeline: [target],
    articles,
    archiveRoot,
    maxAttempts: 3,
    captureArticleFn: async (article) => {
      calls.push(article.id);
      await writeCapture(archiveRoot, article.id, "captured " + article.id);
      return { status: "captured-html" };
    },
  });

  assert.deepEqual(calls, ["blocked-cited"]);
  assert.equal(result.recoveryState, "captured-cited");
  assert.equal(result.selectedLead.id, "blocked-cited");
  assert.equal(result.attemptedCount, 1);
  assert.equal(result.attempts[0].kind, "cited");
  assert.equal(result.diagnosis.evidenceState, "ready");
});

test("audit evidence recovery falls through to ranked leads when cited retry fails", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-recover-cited-fallback-"));
  const calls = [];
  const result = await recoverAuditEvidence({
    id: "target",
    timeline: [target],
    articles,
    archiveRoot,
    maxAttempts: 3,
    captureArticleFn: async (article) => {
      calls.push(article.id);
      if (article.id === "blocked-cited") return { status: "transient-failure" };
      await writeCapture(archiveRoot, article.id, "captured " + article.id);
      return { status: "captured-html" };
    },
  });

  assert.deepEqual(calls, ["blocked-cited", "lead-a"]);
  assert.equal(result.recoveryState, "captured-lead");
  assert.equal(result.selectedLead.id, "lead-a");
  assert.deepEqual(result.attempts.map((attempt) => attempt.kind), ["cited", "lead"]);
});

test("audit evidence recovery retries stale cited extraction failures without forcing replacement failures", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-recover-stale-extraction-"));
  await writeStatus(archiveRoot, "blocked-cited", "unusable-extraction");
  await writeStatus(archiveRoot, "lead-a", "unusable-extraction");
  const calls = [];
  const result = await recoverAuditEvidence({
    id: "target",
    timeline: [target],
    articles,
    archiveRoot,
    maxAttempts: 2,
    captureArticleFn: async (article) => {
      calls.push(article.id);
      await writeCapture(archiveRoot, article.id, "captured " + article.id);
      return { status: "captured-html" };
    },
  });

  assert.deepEqual(calls, ["blocked-cited"]);
  assert.equal(result.recoveryState, "captured-cited");
  assert.equal(result.skippedPersistent.some((item) => item.id === "lead-a"), true);
});

test("audit evidence recovery retries a legacy short HTML capture instead of trusting it", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-recover-short-html-"));
  await writeLegacyShortHtml(archiveRoot, "blocked-cited", "Generic site shell only");
  const calls = [];
  const result = await recoverAuditEvidence({
    id: "target",
    timeline: [target],
    articles,
    archiveRoot,
    captureArticleFn: async (article) => {
      calls.push(article.id);
      await writeCapture(archiveRoot, article.id, "The publisher article now contains a full report about the ASEAN delegation and disputed Trat border infrastructure.");
      return { status: "captured-html" };
    },
  });

  assert.deepEqual(calls, ["blocked-cited"]);
  assert.equal(result.recoveryState, "captured-cited");
  assert.equal(result.diagnosis.evidenceState, "ready");
});

test("audit evidence recovery reuses an already captured ranked lead without network work", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-recover-existing-"));
  await writeStatus(archiveRoot, "blocked-cited", "access-blocked");
  await writeCapture(archiveRoot, "lead-a", "publisher text");
  let calls = 0;
  const result = await recoverAuditEvidence({
    id: "target",
    timeline: [target],
    articles,
    archiveRoot,
    captureArticleFn: async () => {
      calls += 1;
      return { status: "captured-html" };
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.recoveryState, "existing-capture");
  assert.equal(result.selectedLead.id, "lead-a");
});

test("audit evidence recovery prefers a retryable cited source over an already captured replacement", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-recover-cited-over-existing-"));
  await writeCapture(archiveRoot, "lead-a", "publisher text");
  const calls = [];
  const result = await recoverAuditEvidence({
    id: "target",
    timeline: [target],
    articles,
    archiveRoot,
    captureArticleFn: async (article) => {
      calls.push(article.id);
      await writeCapture(archiveRoot, article.id, "captured " + article.id);
      return { status: "captured-html" };
    },
  });

  assert.deepEqual(calls, ["blocked-cited"]);
  assert.equal(result.recoveryState, "captured-cited");
  assert.equal(result.selectedLead.id, "blocked-cited");
});

test("audit evidence recovery falls back to an already captured replacement after cited retry fails", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-recover-cited-fail-existing-"));
  await writeCapture(archiveRoot, "lead-a", "publisher text");
  const calls = [];
  const result = await recoverAuditEvidence({
    id: "target",
    timeline: [target],
    articles,
    archiveRoot,
    captureArticleFn: async (article) => {
      calls.push(article.id);
      return { status: "transient-failure" };
    },
  });

  assert.deepEqual(calls, ["blocked-cited"]);
  assert.equal(result.recoveryState, "existing-capture");
  assert.equal(result.selectedLead.id, "lead-a");
});

test("audit evidence recovery skips persistent failures unless forced", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-recover-skip-"));
  await writeStatus(archiveRoot, "blocked-cited", "access-blocked");
  await writeStatus(archiveRoot, "lead-a", "access-blocked");
  const calls = [];
  const result = await recoverAuditEvidence({
    id: "target",
    timeline: [target],
    articles,
    archiveRoot,
    maxAttempts: 1,
    captureArticleFn: async (article) => {
      calls.push(article.id);
      return { status: "transient-failure" };
    },
  });

  assert.deepEqual(calls, ["lead-b"]);
  assert.deepEqual(result.skippedPersistent.map((item) => item.id), ["blocked-cited", "lead-a"]);
  assert.deepEqual(result.skippedPersistent.map((item) => item.kind), ["cited", "lead"]);
});

test("audit evidence recovery does not auto-capture a weak cross-category lead", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-recover-weak-"));
  await writeStatus(archiveRoot, "blocked-cited", "access-blocked");
  const weakArticles = [
    articles[0],
    {
      id: "weak",
      source: "Weak Lead",
      sourceUrl: "https://example.test/weak",
      publishedAt: Date.UTC(2026, 6, 5),
      category: "humanitarian",
      title: "ASEAN Delegation Inspects Aid Infrastructure",
      summary: "ASEAN delegation inspects disputed border infrastructure and military construction after displacement.",
    },
  ];
  let calls = 0;
  const result = await recoverAuditEvidence({
    id: "target",
    timeline: [target],
    articles: weakArticles,
    archiveRoot,
    captureArticleFn: async () => {
      calls += 1;
      return { status: "captured-html" };
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.recoveryState, "no-recoverable-lead");
  assert.equal(result.rejectedLowConfidence[0].id, "weak");
});

test("audit evidence recovery stops immediately when cited evidence is already ready", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-recover-ready-"));
  await writeCapture(archiveRoot, "blocked-cited", "publisher text");
  let calls = 0;
  const result = await recoverAuditEvidence({
    id: "target",
    timeline: [target],
    articles,
    archiveRoot,
    captureArticleFn: async () => {
      calls += 1;
      return { status: "captured-html" };
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.recoveryState, "not-needed");
});
