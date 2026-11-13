import assert from "node:assert/strict";
import test from "node:test";
import { normalizeArticleUrl } from "../research/lib/articles.mjs";

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
