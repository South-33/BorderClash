import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7fm0xtrkwnd9qkjjbgjaa2z1812hr1";
const evidenceIds = ["07e72069fab21f0a3441c5f98ae4ae79", "bb5cec8492f32741f7ab195476d47614"];
const timeline = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const news = readFileSync("data/news/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = timeline.find((item) => item.id === id);

test("Dec 29 landmine row keeps the 11th count but removes unsupported time and NMAC claim", () => {
  assert.equal(event.date, "2025-12-29");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, evidenceIds);
  assert.match(event.description, /number of Thai soldiers injured by mines to 11/u);
  assert.match(event.description, /responsibility claim is a Thai allegation/u);
  assert.doesNotMatch(event.description, /NMAC condemned|violation of the Ottawa Convention|10:00/u);
  assert.ok(evidenceIds.every((evidenceId) => news.some((article) => article.id === evidenceId)));
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
