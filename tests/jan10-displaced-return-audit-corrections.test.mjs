import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7ec6nh690j2mjnfkynnpyn51813s5v";
const evidenceId = "js77b6c6tdrk7m3z8a1tmze8gd7z1d39";
const timeline = readFileSync("data/timeline/2026-01.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const news = readFileSync("data/news/2026-01.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = timeline.find((item) => item.id === id);
const evidence = news.find((item) => item.id === evidenceId);

test("Jan 10 return milestone follows the status date stated in the captured Jan 11 report", () => {
  assert.equal(event.date, "2026-01-10");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.title, /Had Returned by Jan 10/u);
  assert.match(event.description, /as of January 10 about 480,000/u);
  assert.match(event.description, /around 167,000 remained/u);
  assert.match(event.description, /no exact event time/u);
  assert.doesNotMatch(event.description, /as of January 11/u);
  assert.match(evidence.summary, /as of January 10 about 480,000/u);
  assert.doesNotMatch(evidence.summary, /As of January 11/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
