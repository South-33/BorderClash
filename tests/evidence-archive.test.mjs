import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  brotliCompressSync,
  deflateSync,
  gzipSync,
} from "node:zlib";
import test from "node:test";
import {
  captureArticle,
  fetchEvidence,
  readCapturedOriginal,
  restoreArchiveCopy,
  storeEvidenceAttempt,
  verifyArchiveCopy,
} from "../research/lib/evidence-archive.mjs";
import {
  captureChangedArticles,
  ingestCandidates,
} from "../research/lib/article-ingest.mjs";

const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];

function htmlResponse(html, { status = 200, headers = {} } = {}) {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...headers,
    },
  });
}

function article(overrides = {}) {
  return {
    category: "diplomatic",
    credibility: 70,
    fetchedAt: Date.UTC(2026, 10, 13, 12, 0, 0),
    publishedAt: Date.UTC(2026, 10, 13, 0, 0, 0),
    source: "Example News",
    sourceUrl: "https://example.com/news/border-update",
    status: "active",
    title: "Thailand and Cambodia hold border talks",
    mediaEnvironment: "international",
    ...overrides,
  };
}

async function tempRoots() {
  const root = await mkdtemp(join(tmpdir(), "borderclash-evidence-"));
  return {
    root,
    dataRoot: join(root, "data"),
    archiveRoot: join(root, "archive"),
    backupRoot: join(root, "backup"),
    restoreRoot: join(root, "restore"),
  };
}

test("evidence fetch rejects non-public destinations and redirect targets", async () => {
  let fetchCount = 0;
  const direct = await fetchEvidence("http://127.0.0.1/private", {
    fetchImpl: async () => {
      fetchCount += 1;
      throw new Error("must not fetch");
    },
    lookupImpl: publicLookup,
  });
  assert.equal(direct.status, "blocked-destination");
  assert.equal(fetchCount, 0);

  const redirected = await fetchEvidence("https://example.com/start", {
    lookupImpl: publicLookup,
    fetchImpl: async () => {
      fetchCount += 1;
      return new Response("", { status: 302, headers: { location: "http://127.0.0.1/secret" } });
    },
  });
  assert.equal(redirected.status, "blocked-destination");
  assert.equal(fetchCount, 1);
});

test("DNS failures are retryable and oversized responses are recorded without unbounded buffering", async () => {
  const dnsError = Object.assign(new Error("getaddrinfo EAI_AGAIN example.com"), { code: "EAI_AGAIN" });
  const dns = await fetchEvidence("https://example.com/article", {
    lookupImpl: async () => {
      throw dnsError;
    },
    fetchImpl: async () => {
      throw new Error("fetch must not run after DNS failure");
    },
  });
  assert.equal(dns.status, "transient-failure");

  const oversized = await fetchEvidence("https://example.com/large", {
    lookupImpl: publicLookup,
    maxBytes: 8,
    fetchImpl: async () => new Response("0123456789", {
      status: 200,
      headers: { "content-type": "text/plain" },
    }),
  });
  assert.equal(oversized.status, "too-large");
});

test("HTML capture preserves Unicode, canonical identity, immutable bytes, backup, and restore", async () => {
  const roots = await tempRoots();
  try {
    const body = [
      "ไทยและកម្ពុជាបានពិភាក្សាព្រំដែនដោយសន្តិវិធី.",
      "Thailand and Cambodia discussed the border peacefully with ASEAN observers present.",
      "Officials from both sides described the meeting as a confidence-building step and said technical teams would continue work on boundary questions.",
      "The report also noted that communities near the frontier were watching the talks closely because crossings and local trade remained affected.",
    ].join(" ");
    const html = [
      "<!doctype html><html><head>",
      '<link rel="canonical" href="https://example.com/news/canonical-border-update?utm_source=test">',
      '<script type="application/ld+json">',
      JSON.stringify({ "@type": "NewsArticle", articleBody: body }),
      "</script></head><body><article><p>Short visible fallback.</p></article></body></html>",
    ].join("");
    let fetchCount = 0;
    const options = {
      ...roots,
      lookupImpl: publicLookup,
      fetchImpl: async () => {
        fetchCount += 1;
        return htmlResponse(html);
      },
    };
    const storedArticle = article({ id: "archive-html-001" });
    const first = await captureArticle(storedArticle, options);
    assert.equal(first.status, "captured-html");
    assert.equal(fetchCount, 1);

    const manifest = JSON.parse(await readFile(join(roots.archiveRoot, storedArticle.id, "manifest.json"), "utf8"));
    assert.equal(manifest.latestStatus, "captured-html");
    assert.equal(manifest.attempts.length, 1);
    const metadata = JSON.parse(await readFile(
      join(roots.archiveRoot, storedArticle.id, "captures", manifest.latestCapture, "metadata.json"),
      "utf8",
    ));
    assert.match(metadata.canonicalUrl, /canonical-border-update/u);
    assert.equal(metadata.encoding, "utf-8");
    const text = await readFile(join(roots.archiveRoot, storedArticle.id, "captures", manifest.latestCapture, "text.txt"), "utf8");
    assert.match(text, /ไทย/u);
    assert.match(text, /កម្ពុជា/u);

    const original = await readCapturedOriginal(storedArticle.id, manifest.latestCapture, options);
    assert.equal(original.toString("utf8"), html);
    assert.deepEqual(await verifyArchiveCopy(storedArticle.id, options), {
      articleId: storedArticle.id,
      ok: true,
      mismatches: [],
      files: 4,
    });

    const reused = await captureArticle(storedArticle, options);
    assert.equal(reused.reused, true);
    assert.equal(fetchCount, 1);

    const restored = await restoreArchiveCopy(storedArticle.id, roots.restoreRoot, options);
    assert.equal(restored.ok, true);
    assert.equal(restored.files, 4);
  } finally {
    await rm(roots.root, { recursive: true, force: true });
  }
});

test("HTML extraction prefers the longest article block over an earlier teaser", async () => {
  const longBody = [
    "This is the actual publisher article body and it is intentionally long enough to pass the evidence threshold.",
    "It contains the material event facts, named actors, dates, and context needed for source verification.",
    "A short article element may appear earlier on publisher pages for a teaser, widget, or navigation card.",
    "The extractor must not stop at that teaser when a substantially longer article block contains the story.",
  ].join(" ");
  const fetched = await fetchEvidence("https://example.com/multiple-articles", {
    lookupImpl: publicLookup,
    fetchImpl: async () => htmlResponse([
      "<html><body>",
      "<article><p>Short teaser.</p></article>",
      "<article><div>" + longBody + "</div></article>",
      "</body></html>",
    ].join("")),
  });
  assert.equal(fetched.status, "captured-html");
  assert.match(fetched.text, /actual publisher article body/u);
  assert.doesNotMatch(fetched.text, /^Short teaser\.$/u);
});

test("HTML extraction can use a publisher article-body div when article tags are teasers", async () => {
  const longBody = [
    "This publisher stores the real story in a dedicated article-body div rather than an article element.",
    "The body includes the event date, named agencies, participant counts, and enough context for verification.",
    "Earlier article tags are only navigation cards and must not prevent extraction of the real report.",
  ].join(" ");
  const fetched = await fetchEvidence("https://example.com/div-article-body", {
    lookupImpl: publicLookup,
    fetchImpl: async () => htmlResponse([
      "<html><body>",
      "<article><p>Navigation teaser.</p></article>",
      '<div class="detail m-c-font-article m-d-initial"><p>',
      longBody,
      "</p></div>",
      "</body></html>",
    ].join("")),
  });
  assert.equal(fetched.status, "captured-html");
  assert.match(fetched.text, /real story in a dedicated article-body div/u);
});

test("HTML capture decodes HTTP compression while preserving the exact received bytes", async (t) => {
  const html = "<html><body><article><p>This publisher article is long enough to verify compressed response decoding. It contains a clear event date, named officials, and enough additional context for the readable-text threshold used by the evidence archive. The stored source bytes must remain exact even though the extracted text is decoded before HTML parsing.</p></article></body></html>";
  const cases = [
    ["gzip", gzipSync(Buffer.from(html))],
    ["br", brotliCompressSync(Buffer.from(html))],
    ["deflate", deflateSync(Buffer.from(html))],
    ["sniffed-gzip", gzipSync(Buffer.from(html))],
    ["double-gzip", gzipSync(gzipSync(Buffer.from(html)))],
  ];
  for (const [encoding, compressed] of cases) {
    await t.test(encoding, async () => {
      const roots = await tempRoots();
      try {
        const headers = { "content-type": "text/html; charset=utf-8" };
        if (encoding !== "sniffed-gzip" && encoding !== "double-gzip") {
          headers["content-encoding"] = encoding;
        }
        const fetched = await fetchEvidence("https://example.com/compressed", {
          lookupImpl: publicLookup,
          fetchImpl: async () => new Response(compressed, { status: 200, headers }),
        });
        assert.equal(fetched.status, "captured-html");
        assert.match(fetched.text, /compressed response decoding/u);
        assert.deepEqual(fetched.body, compressed);

        const articleId = `archive-compressed-${encoding}`;
        await storeEvidenceAttempt(articleId, fetched, roots);
        const manifest = JSON.parse(await readFile(join(roots.archiveRoot, articleId, "manifest.json"), "utf8"));
        const metadata = JSON.parse(await readFile(
          join(roots.archiveRoot, articleId, "captures", manifest.latestCapture, "metadata.json"),
          "utf8",
        ));
        const expectedEncoding = encoding === "sniffed-gzip"
          ? "gzip"
          : encoding === "double-gzip"
            ? "gzip, gzip"
            : encoding;
        assert.equal(metadata.contentEncoding, expectedEncoding);
        assert.deepEqual(await readCapturedOriginal(articleId, manifest.latestCapture, roots), compressed);
      } finally {
        await rm(roots.root, { recursive: true, force: true });
      }
    });
  }
});

test("recapturing identical bytes can repair derived text without changing the source revision", async () => {
  const roots = await tempRoots();
  try {
    const storedArticle = article({ id: "archive-reextract-001" });
    const html = "<html><body><article><p>This is a sufficiently long publisher article used to verify re-extraction from identical received bytes. The raw response stays identical while the derived text can be repaired after the extractor improves. Additional context keeps the article safely above the minimum extraction threshold for this test fixture.</p></article></body></html>";
    const compressed = gzipSync(Buffer.from(html));
    await storeEvidenceAttempt(storedArticle.id, {
      status: "captured-html",
      requestedUrl: storedArticle.sourceUrl,
      finalUrl: storedArticle.sourceUrl,
      contentType: "text/html",
      body: compressed,
      text: "\u001f� stale compressed text",
      sha256: createHash("sha256").update(compressed).digest("hex"),
      byteLength: compressed.length,
    }, roots);
    const before = JSON.parse(await readFile(join(roots.archiveRoot, storedArticle.id, "manifest.json"), "utf8"));

    const fetched = await fetchEvidence(storedArticle.sourceUrl, {
      lookupImpl: publicLookup,
      fetchImpl: async () => new Response(compressed, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    });
    await storeEvidenceAttempt(storedArticle.id, fetched, roots);
    const after = JSON.parse(await readFile(join(roots.archiveRoot, storedArticle.id, "manifest.json"), "utf8"));
    assert.equal(after.latestCapture, before.latestCapture);
    const text = await readFile(
      join(roots.archiveRoot, storedArticle.id, "captures", after.latestCapture, "text.txt"),
      "utf8",
    );
    assert.match(text, /re-extraction from identical received bytes/u);
    assert.equal((await verifyArchiveCopy(storedArticle.id, roots)).ok, true);
  } finally {
    await rm(roots.root, { recursive: true, force: true });
  }
});

test("capture records a transient failure, retries, and keeps one immutable revision for identical bytes", async () => {
  const roots = await tempRoots();
  try {
    const storedArticle = article({ id: "archive-retry-001" });
    let attempt = 0;
    const html = "<html><body><article><p>This is a sufficiently long article body for a successful retry after a temporary publisher outage. It has enough readable text for extraction. The article continues with additional context about the border communities, the diplomatic process, and the practical effects of delayed crossings. Officials say both governments are still exchanging information through established channels, while residents are waiting for clearer guidance about movement and trade.</p></article></body></html>";
    const options = {
      ...roots,
      lookupImpl: publicLookup,
      fetchImpl: async () => {
        attempt += 1;
        return attempt === 1
          ? new Response("temporary", { status: 503, headers: { "content-type": "text/plain" } })
          : htmlResponse(html);
      },
    };
    const failed = await captureArticle(storedArticle, options);
    assert.equal(failed.status, "transient-failure");
    const succeeded = await captureArticle(storedArticle, { ...options, force: true });
    assert.equal(succeeded.status, "captured-html");
    const sameAgain = await fetchEvidence(storedArticle.sourceUrl, options);
    await storeEvidenceAttempt(storedArticle.id, sameAgain, options);

    const manifest = JSON.parse(await readFile(join(roots.archiveRoot, storedArticle.id, "manifest.json"), "utf8"));
    assert.equal(manifest.attempts.length, 3);
    assert.equal(manifest.attempts[0].status, "transient-failure");
    assert.equal(manifest.attempts[1].status, "captured-html");
    assert.equal(manifest.attempts[2].captureKey, manifest.attempts[1].captureKey);
    assert.equal((await verifyArchiveCopy(storedArticle.id, options)).ok, true);
  } finally {
    await rm(roots.root, { recursive: true, force: true });
  }
});

test("archive rejects inconsistent body checksum or length metadata", async () => {
  const roots = await tempRoots();
  try {
    const body = Buffer.from("integrity fixture");
    await assert.rejects(
      storeEvidenceAttempt("archive-integrity-001", {
        status: "captured-text",
        requestedUrl: "https://example.com/integrity",
        finalUrl: "https://example.com/integrity",
        contentType: "text/plain",
        body,
        text: body.toString("utf8"),
        sha256: "0".repeat(64),
        byteLength: body.length,
      }, roots),
      /SHA-256/u,
    );
    await assert.rejects(
      storeEvidenceAttempt("archive-integrity-002", {
        status: "captured-text",
        requestedUrl: "https://example.com/integrity",
        finalUrl: "https://example.com/integrity",
        contentType: "text/plain",
        body,
        text: body.toString("utf8"),
        sha256: createHash("sha256").update(body).digest("hex"),
        byteLength: body.length + 1,
      }, roots),
      /body length/u,
    );
  } finally {
    await rm(roots.root, { recursive: true, force: true });
  }
});

test("capture preserves unusable HTML and material PDF source bytes", async () => {
  const roots = await tempRoots();
  try {
    const short = await fetchEvidence("https://example.com/short", {
      lookupImpl: publicLookup,
      fetchImpl: async () => htmlResponse("<html><body><p>tiny</p></body></html>"),
    });
    assert.equal(short.status, "unusable-extraction");
    await storeEvidenceAttempt("archive-short-001", short, roots);
    const shortManifest = JSON.parse(await readFile(join(roots.archiveRoot, "archive-short-001", "manifest.json"), "utf8"));
    const shortOriginal = await readCapturedOriginal("archive-short-001", shortManifest.latestCapture, roots);
    assert.match(shortOriginal.toString("utf8"), /tiny/u);

    const pdfBytes = Buffer.from("%PDF-1.7\nfixture document\n%%EOF\n");
    const pdf = await fetchEvidence("https://example.com/report.pdf", {
      lookupImpl: publicLookup,
      fetchImpl: async () => new Response(pdfBytes, {
        status: 200,
        headers: { "content-type": "application/pdf" },
      }),
    });
    assert.equal(pdf.status, "captured-document");
    await storeEvidenceAttempt("archive-pdf-001", pdf, roots);
    const pdfManifest = JSON.parse(await readFile(join(roots.archiveRoot, "archive-pdf-001", "manifest.json"), "utf8"));
    assert.deepEqual(await readCapturedOriginal("archive-pdf-001", pdfManifest.latestCapture, roots), pdfBytes);
  } finally {
    await rm(roots.root, { recursive: true, force: true });
  }
});

test("ingest reuses redirect identity, preserves syndicated copies, and flags same-publisher ambiguity", async () => {
  const roots = await tempRoots();
  try {
    await mkdir(join(roots.dataRoot, "news"), { recursive: true });
    const existing = article({
      id: "existing-article-001",
      sourceUrl: "https://example.com/news/canonical-border-update",
      title: "Thailand and Cambodia hold border talks",
    });
    await writeFile(join(roots.dataRoot, "news", "2026-11.jsonl"), JSON.stringify(existing) + "\n", "utf8");

    const longHtml = "<html><body><article><p>This fixture contains enough readable evidence text to produce a successful HTML capture without using the public network. The content is intentionally ordinary.</p></article></body></html>";
    const responses = new Map([
      ["https://example.com/short-link", new Response("", {
        status: 302,
        headers: { location: "https://example.com/news/canonical-border-update" },
      })],
      ["https://example.com/news/canonical-border-update", htmlResponse(longHtml)],
      ["https://wire.example.net/copy/1", htmlResponse(longHtml)],
      ["https://example.com/news/border-talks-followup", htmlResponse(longHtml)],
    ]);
    const fetchImpl = async (url) => {
      const response = responses.get(url);
      if (!response) throw new Error(`unexpected fetch ${url}`);
      return response.clone();
    };
    const common = { ...roots, lookupImpl: publicLookup, fetchImpl, now: Date.UTC(2026, 10, 13, 12, 30, 0) };

    const reuse = await ingestCandidates([
      article({ sourceUrl: "https://example.com/short-link" }),
    ], common);
    assert.equal(reuse[0].action, "existing");
    assert.equal(reuse[0].id, existing.id);

    const syndicated = await ingestCandidates([
      article({
        source: "Wire Copy",
        sourceUrl: "https://wire.example.net/copy/1",
        title: existing.title,
        provenanceId: "wire:example-border-talks-2026-11-13",
      }),
    ], common);
    assert.equal(syndicated[0].action, "added");
    assert.notEqual(syndicated[0].id, existing.id);
    const syndicatedRows = (await readFile(join(roots.dataRoot, "news", "2026-11.jsonl"), "utf8"))
      .trim().split(/\r?\n/u).map(JSON.parse);
    assert.equal(syndicatedRows.find((row) => row.id === syndicated[0].id).provenanceId, "wire:example-border-talks-2026-11-13");
    const syndicatedAgain = await ingestCandidates([
      article({
        source: "Wire Copy",
        sourceUrl: "https://wire.example.net/copy/1",
        title: existing.title,
      }),
    ], common);
    assert.equal(syndicatedAgain[0].action, "existing");
    assert.equal(syndicatedAgain[0].id, syndicated[0].id);

    const ambiguous = await ingestCandidates([
      article({
        sourceUrl: "https://example.com/news/border-talks-followup",
        title: "Thailand and Cambodia hold border talks today",
      }),
    ], common);
    assert.equal(ambiguous[0].action, "review");
    assert.equal(ambiguous[0].ambiguous[0].id, existing.id);

    const rows = (await readFile(join(roots.dataRoot, "news", "2026-11.jsonl"), "utf8"))
      .trim().split(/\r?\n/u).map(JSON.parse);
    assert.equal(rows.length, 2);
  } finally {
    await rm(roots.root, { recursive: true, force: true });
  }
});

test("ingest keeps syndicated publisher records distinct while surfacing shared provenance", async () => {
  const roots = await tempRoots();
  try {
    await mkdir(join(roots.dataRoot, "news"), { recursive: true });
    const html = "<html><body><article><p>This fixture is long enough to be captured while two separate publishers retain distinct canonical records for the same underlying wire report.</p></article></body></html>";
    const common = {
      ...roots,
      lookupImpl: publicLookup,
      fetchImpl: async () => htmlResponse(html),
      now: Date.UTC(2026, 10, 13, 12, 30, 0),
    };
    const first = await ingestCandidates([
      article({
        source: "Publisher A",
        sourceUrl: "https://publisher-a.example/report/1",
        provenanceId: "wire:fixture:2026-11-13-border",
      }),
    ], common);
    const second = await ingestCandidates([
      article({
        source: "Publisher B",
        sourceUrl: "https://publisher-b.example/report/77",
        provenanceId: "wire:fixture:2026-11-13-border",
      }),
    ], common);
    assert.equal(first[0].action, "added");
    assert.equal(second[0].action, "added");
    assert.notEqual(first[0].id, second[0].id);
    assert.deepEqual(second[0].sharedProvenanceWith, [first[0].id]);
  } finally {
    await rm(roots.root, { recursive: true, force: true });
  }
});

test("ingest reuses a known publisher article ID across mobile and desktop aliases", async () => {
  const roots = await tempRoots();
  try {
    await mkdir(join(roots.dataRoot, "news"), { recursive: true });
    const existing = article({
      id: "freshnews-existing-001",
      source: "Fresh News",
      sourceUrl: "https://freshnewsasia.com/localnews/412489-2025-12-18-11-52-51",
      title: "Border situation update",
    });
    await writeFile(join(roots.dataRoot, "news", "2026-11.jsonl"), JSON.stringify(existing) + "\n", "utf8");
    let fetchCount = 0;
    const result = await ingestCandidates([
      article({
        source: "Fresh News",
        sourceUrl: "https://m.freshnewsasia.com/localnews/412489-2025-12-18-11-52-51",
        title: "Border situation update",
      }),
    ], {
      ...roots,
      lookupImpl: publicLookup,
      fetchImpl: async () => {
        fetchCount += 1;
        return htmlResponse("<html><body><article><p>This should only be fetched once for capture after the alias resolves to the existing canonical record.</p></article></body></html>");
      },
    });
    assert.equal(result[0].action, "existing");
    assert.equal(result[0].id, existing.id);
    assert.equal(fetchCount, 1);
    const rows = (await readFile(join(roots.dataRoot, "news", "2026-11.jsonl"), "utf8"))
      .trim().split(/\r?\n/u).map(JSON.parse);
    assert.equal(rows.length, 1);
  } finally {
    await rm(roots.root, { recursive: true, force: true });
  }
});

test("ingest refuses a non-public source before creating a canonical article", async () => {
  const roots = await tempRoots();
  try {
    await mkdir(join(roots.dataRoot, "news"), { recursive: true });
    const result = await ingestCandidates([
      article({ sourceUrl: "http://127.0.0.1/private-report" }),
    ], {
      ...roots,
      lookupImpl: publicLookup,
      fetchImpl: async () => {
        throw new Error("must not fetch private source");
      },
    });
    assert.equal(result[0].action, "review");
    const files = await import("node:fs/promises").then(({ readdir }) => readdir(join(roots.dataRoot, "news")));
    assert.deepEqual(files, []);
  } finally {
    await rm(roots.root, { recursive: true, force: true });
  }
});

test("ingest reconciles same-day publisher metadata but holds a conflicting publication date", async () => {
  const roots = await tempRoots();
  try {
    await mkdir(join(roots.dataRoot, "news"), { recursive: true });
    const body = `<article><p>${"Publisher evidence text. ".repeat(30)}</p></article>`;
    const responses = new Map([
      ["https://example.com/exact", `<html><head><meta property="article:published_time" content="2026-11-21T03:31:44Z"></head><body>${body}</body></html>`],
      ["https://example.com/date-only", `<html><body><time itemprop="datePublished" datetime="2026-11-21">21 November 2026</time>${body}</body></html>`],
      ["https://example.com/wrong-date", `<html><head><meta property="article:published_time" content="2026-10-31T15:32:59+07:00"></head><body>${body}</body></html>`],
    ]);
    const options = {
      ...roots,
      lookupImpl: publicLookup,
      fetchImpl: async (url) => htmlResponse(responses.get(url)),
      now: Date.UTC(2026, 10, 22, 0, 0, 0),
    };
    const exact = await ingestCandidates([article({
      sourceUrl: "https://example.com/exact",
      title: "Exact publication time",
      publishedAt: Date.parse("2026-11-21T07:02:00Z"),
    })], options);
    assert.equal(exact[0].action, "added");
    assert.equal(exact[0].publicationAdjustment.to, Date.parse("2026-11-21T03:31:44Z"));

    const dateOnly = await ingestCandidates([article({
      sourceUrl: "https://example.com/date-only",
      title: "Date only publication",
      publishedAt: Date.parse("2026-11-21T07:02:00Z"),
    })], options);
    assert.equal(dateOnly[0].action, "added");
    assert.equal(dateOnly[0].publicationAdjustment.to, Date.parse("2026-11-21T00:00:00Z"));

    const conflict = await ingestCandidates([article({
      sourceUrl: "https://example.com/wrong-date",
      title: "Wrong publication date",
      publishedAt: Date.parse("2026-11-21T07:02:00Z"),
    })], options);
    assert.equal(conflict[0].action, "review");
    assert.match(conflict[0].reason, /publication date conflicts/u);
    assert.equal(conflict[0].publisherPublishedAtHint.date, "2026-10-31");

    const rows = (await readFile(join(roots.dataRoot, "news", "2026-11.jsonl"), "utf8"))
      .trim().split(/\r?\n/u).map(JSON.parse);
    assert.equal(rows.find((row) => row.sourceUrl === "https://example.com/exact").publishedAt, Date.parse("2026-11-21T03:31:44Z"));
    assert.equal(rows.find((row) => row.sourceUrl === "https://example.com/date-only").publishedAt, Date.parse("2026-11-21T00:00:00Z"));
    assert.equal(rows.some((row) => row.sourceUrl === "https://example.com/wrong-date"), false);
  } finally {
    await rm(roots.root, { recursive: true, force: true });
  }
});

test("capture-changed only captures new or source-changed rows from touched and untracked months", async () => {
  const roots = await tempRoots();
  try {
    await mkdir(join(roots.dataRoot, "news"), { recursive: true });
    const unchanged = article({ id: "unchanged-001" });
    const added = article({
      id: "new-month-001",
      sourceUrl: "https://example.net/new",
      source: "New Publisher",
    });
    const untracked = article({
      id: "untracked-month-001",
      sourceUrl: "https://example.org/untracked",
      source: "Untracked Publisher",
      publishedAt: Date.UTC(2026, 11, 1, 0, 0, 0),
    });
    await writeFile(
      join(roots.dataRoot, "news", "2026-11.jsonl"),
      [unchanged, added].map((row) => JSON.stringify(row)).join("\n") + "\n",
      "utf8",
    );
    await writeFile(
      join(roots.dataRoot, "news", "2026-12.jsonl"),
      JSON.stringify(untracked) + "\n",
      "utf8",
    );
    const calls = [];
    const gitCommand = async (args) => {
      calls.push(args);
      if (args[0] === "diff") return "data/news/2026-11.jsonl\n";
      if (args[0] === "ls-files") return "data/news/2026-12.jsonl\n";
      if (args[0] === "show") return JSON.stringify(unchanged) + "\n";
      throw new Error(`unexpected git args: ${args.join(" ")}`);
    };
    let fetchCount = 0;
    const result = await captureChangedArticles("base-ref", {
      ...roots,
      gitCommand,
      lookupImpl: publicLookup,
      fetchImpl: async () => {
        fetchCount += 1;
        return htmlResponse("<html><body><article><p>This is enough body text for the changed article capture fixture. It should be the only network request made during this test.</p></article></body></html>");
      },
    });
    assert.equal(fetchCount, 2);
    assert.equal(result.length, 2);
    assert.deepEqual(result.map(({ articleId }) => articleId).sort(), [added.id, untracked.id].sort());
    assert.ok(calls.some((args) => args[0] === "diff"));
    assert.ok(calls.some((args) => args[0] === "show"));
  } finally {
    await rm(roots.root, { recursive: true, force: true });
  }
});

test("capture-changed holds a manual publisher-ID alias for identity review", async () => {
  const roots = await tempRoots();
  try {
    await mkdir(join(roots.dataRoot, "news"), { recursive: true });
    const existing = article({
      id: "existing-freshnews-001",
      source: "Fresh News",
      sourceUrl: "https://freshnewsasia.com/localnews/412489-2025-12-18-11-52-51",
    });
    const alias = article({
      id: "manual-alias-001",
      source: "Fresh News",
      sourceUrl: "https://m.freshnewsasia.com/localnews/412489-2025-12-18-11-52-51",
    });
    await writeFile(
      join(roots.dataRoot, "news", "2026-11.jsonl"),
      [existing, alias].map((row) => JSON.stringify(row)).join("\n") + "\n",
      "utf8",
    );
    const gitCommand = async (args) => {
      if (args[0] === "diff") return "data/news/2026-11.jsonl\n";
      if (args[0] === "ls-files") return "";
      if (args[0] === "show") return JSON.stringify(existing) + "\n";
      throw new Error(`unexpected git args: ${args.join(" ")}`);
    };
    let fetchCount = 0;
    const result = await captureChangedArticles("base-ref", {
      ...roots,
      gitCommand,
      lookupImpl: publicLookup,
      fetchImpl: async () => {
        fetchCount += 1;
        return htmlResponse("<html><body><article><p>This network path should not run because publisher identity catches the alias before fetch.</p></article></body></html>");
      },
    });
    assert.equal(fetchCount, 0);
    assert.equal(result.length, 1);
    assert.equal(result[0].articleId, alias.id);
    assert.equal(result[0].status, "identity-conflict");
    assert.deepEqual(result[0].existingIds, [existing.id]);
  } finally {
    await rm(roots.root, { recursive: true, force: true });
  }
});
