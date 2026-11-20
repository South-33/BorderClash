import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks72qnh1y65m45xb8jhmm8ps85812q55";
const evidenceId = "a5d66294a47b7a4594a2ef080783fd5d";
const timeline = readFileSync("data/timeline/2026-01.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const news = readFileSync("data/news/2026-01.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = timeline.find((item) => item.id === id);

test("Jan 6 fishing-vessel row uses the diplomatic note's 11:30 time and attributes maritime claims", () => {
  assert.equal(event.date, "2026-01-06");
  assert.equal(event.timeOfDay, "11:30");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.description, /four Cambodian fishermen/u);
  assert.match(event.description, /Cambodia's stated position/u);
  assert.match(event.description, /does not independently establish/u);
  assert.doesNotMatch(event.description, /14:30/u);
  assert.ok(news.some((article) => article.id === evidenceId));
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
