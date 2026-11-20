import assert from "node:assert/strict";
import test from "node:test";
import { articleCountByEnvironment, normalizeArticleUrl } from "../research/lib/articles.mjs";

test("canonical article helpers keep one simple counting model", () => {
  assert.equal(normalizeArticleUrl(" https://example.com/story/ "), "https://example.com/story");
  assert.deepEqual(articleCountByEnvironment([
    { mediaEnvironment: "thailand-domestic" },
    { mediaEnvironment: "cambodia-domestic" },
    { mediaEnvironment: "international" },
    { mediaEnvironment: "international", status: "archived" },
  ]), { thailand: 1, cambodia: 1, international: 2, total: 4 });
});
