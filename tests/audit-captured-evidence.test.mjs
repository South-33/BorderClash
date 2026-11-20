import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildAuditCapturedEvidence } from "../research/lib/audit-captured-evidence.mjs";

async function writeCapture(root, id, text, status = "captured-html") {
  const key = `capture-${id}`;
  const articleRoot = join(root, id);
  const captureRoot = join(articleRoot, "captures", key);
  await mkdir(captureRoot, { recursive: true });
  await writeFile(join(articleRoot, "manifest.json"), JSON.stringify({ latestCapture: key, latestStatus: status }), "utf8");
  await writeFile(join(captureRoot, "text.txt"), text, "utf8");
}

async function writeDocumentCapture(root, id) {
  const key = `capture-${id}`;
  const articleRoot = join(root, id);
  const captureRoot = join(articleRoot, "captures", key);
  await mkdir(captureRoot, { recursive: true });
  await writeFile(join(articleRoot, "manifest.json"), JSON.stringify({ latestCapture: key, latestStatus: "captured-document" }), "utf8");
  await writeFile(join(captureRoot, "original.pdf"), "fake pdf bytes", "utf8");
}

test("captured audit evidence reads multilingual publisher text with bounded excerpts", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-captured-"));
  await writeCapture(archiveRoot, "khmer", "  ភ្នំពេញ៖  អត្ថបទសាកល្បង\r\n\r\nជួរទីពីរ  ", "captured-text");
  await writeCapture(archiveRoot, "long", "x".repeat(5_000));
  const packet = {
    id: "event-1",
    evidence: {
      articles: [
        { id: "khmer", source: "Khmer Source", sourceUrl: "https://example.test/khmer" },
        { id: "long", source: "Long Source", sourceUrl: "https://example.test/long" },
        { id: "missing", source: "Missing Source", sourceUrl: "https://example.test/missing" },
      ],
    },
  };

  const result = await buildAuditCapturedEvidence(packet, { archiveRoot, perArticleChars: 1_000, totalChars: 1_500 });
  assert.equal(result.recordId, "event-1");
  assert.equal(result.articleCount, 3);
  assert.equal(result.capturedCount, 2);
  assert.equal(result.excerptChars, 1_032);
  assert.equal(result.captures[0].text, "ភ្នំពេញ៖ អត្ថបទសាកល្បង\n\nជួរទីពីរ");
  assert.equal(result.captures[1].excerptLength, 1_000);
  assert.equal(result.captures[1].truncated, true);
  assert.equal(result.captures[2].captureFound, false);
});

test("captured audit evidence accepts a news record when supplied as its own evidence", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-news-captured-"));
  await writeCapture(archiveRoot, "article-1", "publisher body", "captured-text");
  const result = await buildAuditCapturedEvidence({
    id: "article-1",
    kind: "news",
    record: { id: "article-1" },
    evidence: { articles: [{ id: "article-1", source: "Publisher" }] },
  }, { archiveRoot });
  assert.equal(result.articleCount, 1);
  assert.equal(result.capturedCount, 1);
  assert.equal(result.captures[0].text, "publisher body");
});

test("captured audit evidence rejects legacy HTML captures below the current archive quality floor", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-short-html-"));
  await writeCapture(archiveRoot, "article-1", "Generic publisher landing page with navigation only.", "captured-html");
  const result = await buildAuditCapturedEvidence({
    id: "event-1",
    evidence: { articles: [{ id: "article-1", source: "Publisher" }] },
  }, { archiveRoot });

  assert.equal(result.capturedCount, 0);
  assert.equal(result.captures[0].captureFound, false);
  assert.equal(result.captures[0].latestStatus, "captured-html");
  assert.equal(result.captures[0].qualityStatus, "short-html-title-mismatch");
});

test("captured audit evidence keeps a short legacy HTML capture when it matches the publisher title", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-short-html-title-match-"));
  await writeCapture(
    archiveRoot,
    "article-1",
    "Ministry of Education says 101 schools in Oddar Meanchey have reopened after the ceasefire.",
    "captured-html",
  );
  const result = await buildAuditCapturedEvidence({
    id: "event-1",
    evidence: {
      articles: [{
        id: "article-1",
        source: "Publisher",
        title: "Ministry of Education: 101 schools in Oddar Meanchey have reopened",
      }],
    },
  }, { archiveRoot });

  assert.equal(result.capturedCount, 1);
  assert.equal(result.captures[0].captureFound, true);
  assert.equal(result.captures[0].qualityStatus, "usable-short-html-title-match");
});

test("captured audit evidence accepts short Khmer HTML when title words are joined to body particles", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-short-khmer-html-"));
  await writeCapture(
    archiveRoot,
    "article-1",
    "ក្រសួងការពារជាតិបានប្រកាសថា យោធាថៃបានបាញ់ផ្លោងសរុប២៨គ្រាប់ ចូលភូមិសាស្ត្រស្រុកសំពៅលូន ខេត្តបាត់ដំបង។",
    "captured-html",
  );
  const result = await buildAuditCapturedEvidence({
    id: "event-1",
    evidence: {
      articles: [{
        id: "article-1",
        source: "Publisher",
        title: "យោធាថៃ បាញ់ផ្លោងជិត30គ្រាប់ ចូលភូមិសាស្ត្រស្រុកសំពៅលូន",
      }],
    },
  }, { archiveRoot });

  assert.equal(result.capturedCount, 1);
  assert.equal(result.captures[0].captureFound, true);
  assert.equal(result.captures[0].qualityStatus, "usable-short-html-title-match");
});

test("captured audit evidence does not treat stale text from an unusable latest attempt as verified", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-stale-capture-"));
  await writeCapture(archiveRoot, "article-1", "stale extracted text", "unusable-extraction");
  const result = await buildAuditCapturedEvidence({
    id: "event-1",
    evidence: { articles: [{ id: "article-1", source: "Publisher" }] },
  }, { archiveRoot });
  assert.equal(result.capturedCount, 0);
  assert.equal(result.captures[0].captureFound, false);
});

test("captured audit evidence extracts text from archived PDFs when no text sidecar exists", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-pdf-capture-"));
  await writeDocumentCapture(archiveRoot, "pdf-article");
  let extractedPath = "";
  const result = await buildAuditCapturedEvidence({
    id: "event-pdf",
    evidence: { articles: [{ id: "pdf-article", source: "Official PDF" }] },
  }, {
    archiveRoot,
    pdfTextExtractor: async (path) => {
      extractedPath = path;
      return "Official treaty text\n\nEffective 8 March 2026";
    },
  });

  assert.match(extractedPath, /original\.pdf$/u);
  assert.equal(result.capturedCount, 1);
  assert.equal(result.captures[0].captureFound, true);
  assert.equal(result.captures[0].latestStatus, "captured-document");
  assert.equal(result.captures[0].text, "Official treaty text\n\nEffective 8 March 2026");
});

test("captured audit evidence keeps document capture non-fatal when PDF extraction is unavailable", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-pdf-missing-tool-"));
  await writeDocumentCapture(archiveRoot, "pdf-article");
  const result = await buildAuditCapturedEvidence({
    id: "event-pdf",
    evidence: { articles: [{ id: "pdf-article", source: "Official PDF" }] },
  }, {
    archiveRoot,
    pdfTextExtractor: async () => { throw new Error("pdftotext missing"); },
  });

  assert.equal(result.capturedCount, 0);
  assert.equal(result.captures[0].captureFound, false);
});
