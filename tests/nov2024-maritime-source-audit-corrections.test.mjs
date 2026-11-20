import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8")
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test("misdated Jan 15 maritime milestone is removed and its VietnamPlus source is restored to November 2024", () => {
  const januaryTimeline = readJsonl("data/timeline/2026-01.jsonl");
  assert.equal(
    januaryTimeline.some((row) => row.id === "ks79nqrvf816pq308d6egkgkkx813ytc"),
    false,
  );

  const januaryNews = readJsonl("data/news/2026-01.jsonl");
  assert.equal(
    januaryNews.some((row) => row.id === "k973sd9ab5avhc6s05fx2gynhd7zg3fm"),
    false,
  );

  const novemberNews = readJsonl("data/news/2024-11.jsonl");
  const article = novemberNews.find((row) => row.id === "k973sd9ab5avhc6s05fx2gynhd7zg3fm");
  assert.ok(article);
  assert.equal(new Date(article.publishedAt).toISOString(), "2024-11-09T11:12:00.000Z");
  assert.equal(article.status, "archived");
  assert.match(article.summary, /November 8, 2024/u);
  assert.match(article.summary, /Paetongtarn Shinawatra/u);
  assert.match(article.summary, /Joint Technical Committee/u);
  assert.match(article.summary, /26,000-square-kilometer/u);
  assert.doesNotMatch(article.summary, /border ceasefire/u);
});
