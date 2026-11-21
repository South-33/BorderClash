import assert from "node:assert/strict";
import test from "node:test";

import { probeEvidenceUrl, summarizeEvidenceProbe } from "../research/lib/evidence-probe.mjs";

test("summarizeEvidenceProbe omits raw bodies and reports a bounded preview", () => {
  const result = summarizeEvidenceProbe({
    status: "captured-html",
    requestedUrl: "https://example.com/a",
    finalUrl: "https://example.com/a",
    canonicalUrl: "https://example.com/story",
    contentType: "text/html",
    byteLength: 999,
    text: "  alpha beta gamma  ",
    body: Buffer.from("must not leak"),
    redirectChain: [],
  }, 10);

  assert.equal(result.usable, true);
  assert.equal(result.resolved, false);
  assert.equal(result.textLength, 16);
  assert.equal(result.preview, "alpha beta");
  assert.equal("body" in result, false);
});

test("probeEvidenceUrl reports blocked sources without writing archive state", async () => {
  const result = await probeEvidenceUrl("https://example.com/blocked", {
    lookupImpl: async () => [{ address: "93.184.216.34", family: 4 }],
    fetchImpl: async () => new Response("blocked", { status: 403 }),
  });

  assert.equal(result.usable, false);
  assert.equal(result.resolved, false);
  assert.equal(result.status, "access-blocked");
  assert.equal(result.httpStatus, 403);
  assert.equal(result.preview, "");
});

test("probe summary preserves a resolved publisher URL when the body is blocked", () => {
  const result = summarizeEvidenceProbe({
    status: "access-blocked",
    requestedUrl: "https://search.example/grounding/abc",
    finalUrl: "https://publisher.example/story/123",
    httpStatus: 403,
    redirectChain: [{
      from: "https://search.example/grounding/abc",
      to: "https://publisher.example/story/123",
      status: 302,
    }],
  });

  assert.equal(result.usable, false);
  assert.equal(result.resolved, true);
  assert.equal(result.finalUrl, "https://publisher.example/story/123");
});

test("probeEvidenceUrl returns readable HTML metadata and preview", async () => {
  const html = `<html><head><title>Example</title><meta property="article:published_time" content="2026-10-31T15:32:59+07:00"></head><body><article><h1>Useful evidence</h1><p>${"Evidence sentence. ".repeat(20)}</p></article></body></html>`;
  const result = await probeEvidenceUrl("https://example.com/story", {
    lookupImpl: async () => [{ address: "93.184.216.34", family: 4 }],
    fetchImpl: async () => new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }),
    previewChars: 60,
  });

  assert.equal(result.usable, true);
  assert.equal(result.status, "captured-html");
  assert.equal(result.contentType, "text/html");
  assert.deepEqual(result.publishedAtHint, {
    raw: "2026-10-31T15:32:59+07:00",
    source: "meta:article:published_time",
    date: "2026-10-31",
    precision: "datetime",
    publishedAt: Date.parse("2026-10-31T15:32:59+07:00"),
  });
  assert.ok(result.textLength >= 120);
  assert.ok(result.preview.length <= 60);
  assert.match(result.preview, /Useful evidence/u);
});
