import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const articleId = "jn7a3p2jjmbnka6qnybmcn8z1x8c8nb6";
const articles = readFileSync("data/news/2026-08.jsonl", "utf8")
  .trim()
  .split(/\r?\n/u)
  .map(JSON.parse);
const article = articles.find((item) => item.id === articleId);

test("older Aug 8 observer article drops transient feed localization after leaving the newest domestic window", () => {
  assert.ok(article);
  assert.equal(article.mediaEnvironment, "cambodia-domestic");
  assert.equal(article.titleKh, undefined);
  assert.equal(article.titleTh, undefined);
});
