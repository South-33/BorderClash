import assert from "node:assert/strict";
import test from "node:test";
import { isValidProvenanceId, normalizeArticleUrl, publisherArticleIdentity } from "../research/lib/articles.mjs";

test("article identity removes harmless URL variation", () => {
  assert.equal(
    normalizeArticleUrl("https://www.akp.gov.kh/post/detail/358619"),
    normalizeArticleUrl("https://akp.gov.kh/post/detail/358619/"),
  );
  assert.equal(
    normalizeArticleUrl("https://example.org/story?utm_source=feed&fbclid=tracking"),
    normalizeArticleUrl("http://www.example.org/story"),
  );
  assert.equal(
    normalizeArticleUrl("https://www.mfa.go.th/en/content/weekly-pb-summary-12012026-en?page=x&menu=y"),
    normalizeArticleUrl("https://mfa.go.th/en/content/weekly-pb-summary-12012026-en"),
  );
  assert.equal(
    normalizeArticleUrl("https://www.channelnewsasia.com/asia/thailand-cuts-fuel-route-5582726"),
    normalizeArticleUrl("https://www.channelnewsasia.com/asia/thailand-cuts-laos-fuel-route-5582726"),
  );
  assert.equal(
    normalizeArticleUrl("https://www.kuna.net.kw/ArticleDetails.aspx?id=3273515&Language=en"),
    normalizeArticleUrl("https://kuna.net.kw/ArticleDetails.aspx?language=en&id=3273515"),
  );
  assert.equal(
    normalizeArticleUrl("https://www.bernama.com/en/world/news.php?id=2529735"),
    normalizeArticleUrl("https://www.bernama.com/en/news.php/?id=2529735"),
  );
});

test("article identity preserves distinguishing query parameters", () => {
  assert.notEqual(
    normalizeArticleUrl("https://youtube.com/watch?v=first"),
    normalizeArticleUrl("https://www.youtube.com/watch?v=second"),
  );
  assert.notEqual(
    normalizeArticleUrl("https://www.thaitv5hd.com/web/content.php?id=60275"),
    normalizeArticleUrl("https://thaitv5hd.com/web/content.php?id=60284"),
  );
  assert.notEqual(
    normalizeArticleUrl("https://asean.bernama.com/news.php?id=2503641"),
    normalizeArticleUrl("https://asean.bernama.com/news.php?id=2505352"),
  );
});

test("publisher article identity joins known mobile and desktop aliases without collapsing syndicated copies", () => {
  assert.equal(
    publisherArticleIdentity("https://freshnewsasia.com/localnews/412489-2025-12-18-11-52-51"),
    "freshnewsasia:412489",
  );
  assert.equal(
    publisherArticleIdentity("https://m.freshnewsasia.com/localnews/412489-2025-12-18-11-52-51"),
    "freshnewsasia:412489",
  );
  assert.equal(
    publisherArticleIdentity("https://www.thaipbs.or.th/news/content/359446"),
    "thaipbs:359446",
  );
  assert.equal(publisherArticleIdentity("https://wire.example.net/copy/412489"), "");
});

test("provenance IDs are stable lowercase keys", () => {
  assert.equal(isValidProvenanceId("wire:reuters:2026-11-13.border"), true);
  assert.equal(isValidProvenanceId("statement:thai-mfa:2026-11-13"), true);
  assert.equal(isValidProvenanceId("Wire:Reuters"), false);
  assert.equal(isValidProvenanceId("ab"), false);
  assert.equal(isValidProvenanceId(123), false);
});
