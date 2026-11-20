import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks71244fzt2tvhchy8fjpchy6n81pvhf";
const evidenceId = "8d5a6b0b270ba8e9e7c2df436684bf4f";
const timeline = readFileSync("data/timeline/2026-02.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse);
const event = timeline.find((item) => item.id === id);
const news = readFileSync("data/news/2026-02.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse);

test("Feb 22 wildfire row removes invented firebreak and exact-time claims", () => {
  assert.equal(event.date, "2026-02-22");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.description, /three fires were burning on the Cambodian side/u);
  assert.match(event.description, /does not report permanent firebreak construction/u);
  assert.match(event.description, /does not .* give an exact event time/u);
  assert.doesNotMatch(event.description, /permanent firebreaks along/u);
  assert.ok(news.some((item) => item.id === evidenceId && item.sourceUrl === "https://www.naewna.com/local/948586"));
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
