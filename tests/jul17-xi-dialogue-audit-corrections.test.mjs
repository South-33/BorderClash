import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks778msyvb2rya3sf00dheev318c5kmj";
const evidenceIds = ["be71d7a21658bc80d73d7963cbf4e6ae", "5d69e0f8126e72580782f701679c6412"];
const timeline = readFileSync("data/timeline/2026-07.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const news = readFileSync("data/news/2026-07.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = timeline.find((item) => item.id === id);

test("July 17 Xi row uses captured first-party readouts for both meetings", () => {
  assert.equal(event.date, "2026-07-17");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, evidenceIds);
  assert.match(event.description, /meeting with Anutin/u);
  assert.match(event.description, /meeting with Hun Manet/u);
  assert.match(event.description, /dialogue and consultation/u);
  assert.match(event.description, /consolidating the ceasefire/u);
  assert.ok(evidenceIds.every((evidenceId) => news.some((article) => article.id === evidenceId)));
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
