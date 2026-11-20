import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Feb 11 displacement row uses the Interior Ministry snapshot rather than article publication time", () => {
  const timeline = readJsonl("data/timeline/2026-02.jsonl");
  const event = timeline.find((row) => row.id === "ks7az6434n6z3zc4rjwqa016pd813hqs");
  const news = readJsonl("data/news/2026-02.jsonl");
  const article = news.find((row) => row.id === "jn75bkjsxpjsy4hmv3zxp91ct180y1v8");

  assert.ok(event);
  assert.ok(article);
  assert.equal(event.date, "2026-02-11");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /82,306/u);
  assert.match(event.description, /covering February 10–11/u);
  assert.match(event.description, /43,283 women/u);
  assert.match(event.description, /27,667 children/u);
  assert.match(event.description, /Banteay Meanchey/u);
  assert.match(event.description, /Preah Vihear/u);
  assert.deepEqual(event.evidenceIds, ["jn75bkjsxpjsy4hmv3zxp91ct180y1v8"]);
  assert.match(article.summary, /82,306 people remained/u);
  assert.match(article.summary, /February 10–11/u);
});
