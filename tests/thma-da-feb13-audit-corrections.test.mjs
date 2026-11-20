import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Feb 13 Thma Da row records the provincial clarification without using publication time as event time", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === "ks7dgtcwxnx97mbk5njeq6st65815twt");
  const news = readJsonl("data/news/2026-02.jsonl");
  const freshNews = news.find((row) => row.id === "jn7e4dsy6tmxa7tf04z4fm0s3n814jgm");
  const khmerTimes = news.find((row) => row.id === "jn79z7qh1756d5wx2cpmv8tx1h814yew");

  assert.ok(event);
  assert.ok(freshNews);
  assert.ok(khmerTimes);
  assert.equal(event.date, "2026-02-13");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Pursat Authorities Counsel Youths/u);
  assert.match(event.description, /met on February 10/u);
  assert.match(event.description, /does not independently determine the boundary status/u);
  assert.match(freshNews.summary, /On February 13/u);
  assert.equal(freshNews.provenanceId, "pursat-admin-feb13-thma-da-youth-guidance");
  assert.equal(khmerTimes.provenanceId, freshNews.provenanceId);
});
