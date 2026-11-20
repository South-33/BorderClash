import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("April 21 Thai PBS World aliases resolve to one canonical article without changing the 09:40 MOU preview", () => {
  const timeline = readJsonl("data/timeline/2026-04.jsonl");
  const news = readJsonl("data/news/2026-04.jsonl");
  const preview = timeline.find((row) => row.id === "ks769spcsagwhv8nh6jrjzgj2s858e46");
  const pressure = timeline.find((row) => row.id === "ks7ft2sfw8mr25gxp080sxj6p185cg27");
  const article = news.find((row) => row.id === "js7ccfjdw9zpjns0rgxq2axasd858an0");

  assert.ok(preview);
  assert.ok(pressure);
  assert.ok(article);
  assert.equal(preview.timeOfDay, "09:40");
  assert.deepEqual(preview.evidenceIds, ["f11df4edbd87e3977af246f6251928c9", article.id]);
  assert.deepEqual(pressure.evidenceIds, [article.id]);
  assert.equal(news.some((row) => row.id === "js766zx30f32ay22n5w78g2rgd85csxm"), false);
  assert.equal(article.status, "active");
  assert.match(article.summary, /On April 21/u);
  assert.match(article.summary, /pressure tactic/u);
  assert.match(article.summary, /National Security Council would meet on April 22/u);
  assert.match(article.summary, /announced review, not a completed withdrawal/u);
});
