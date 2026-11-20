import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const eventId = "ks7c7h8jwafk0x3pz34kyr10f5812yz2";
const evidenceId = "feba039e1fe52f99d06f8a319d89bbaf";

test("December 13 Sa Kaeo row uses the captured 18:00 First Army summary", () => {
  const event = read("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-13");
  assert.equal(event.timeOfDay, "18:00");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("battlefield and detention claims remain attributed to the First Army Region", () => {
  const event = read("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.match(event.title, /First Army Region Says/u);
  assert.match(event.description, /Ban Nong Chan/u);
  assert.match(event.description, /BM-21/u);
  assert.match(event.description, /third day/u);
  assert.match(event.description, /21,903/u);
  assert.match(event.description, /First Army Region's account/u);
});

test("unsupported original humanitarian details are removed", () => {
  const event = read("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.doesNotMatch(event.title, /Thousands/u);
  assert.doesNotMatch(event.description, /aid routes were cut[^,]*leaving thousands/u);
  assert.match(event.description, /does not establish an 11:00 event time/u);
  assert.match(event.description, /does not establish .*how many Thai nationals/u);
});

test("Thai and Khmer copies preserve supported figures and attribution", () => {
  const event = read("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  for (const value of [event.descriptionTh, event.descriptionKh]) {
    for (const token of ["18:00", "13", "BM-21", "3", "8", "48", "21,903", "11:00"]) assert.ok(value.includes(token), token);
  }
});

test("new Thai Rath evidence row is the captured source used by the event", () => {
  const article = read("data/news/2025-12.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.equal(article.source, "Thai Rath");
  assert.match(article.summary, /First Army Region Operations Center/u);
  assert.match(article.summary, /third day/u);
});
