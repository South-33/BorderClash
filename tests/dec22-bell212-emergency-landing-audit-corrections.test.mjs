import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7a74qmdhxhary44knqm5pp9n812prg";
const evidenceId = "692b4ea8bb16d0e67ba0bb2dcbf39690";
const timeline = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const news = readFileSync("data/news/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = timeline.find((item) => item.id === id);

test("Dec 22 Bell 212 row records an emergency landing with four injured crew", () => {
  assert.equal(event.date, "2025-12-22");
  assert.equal(event.timeOfDay, "17:19");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.title, /Emergency Landing/u);
  assert.match(event.description, /statement that at 17:19 on December 22/u);
  assert.match(event.description, /Four crew members/u);
  assert.match(event.description, /cause of the incident remained under investigation/u);
  assert.doesNotMatch(event.title, /Crash/u);
  assert.doesNotMatch(event.description, /destroying two buildings|sniper nests|scam hubs/u);
  assert.doesNotMatch(event.description, /captured report|separate Poipet/u);
  assert.ok(news.some((article) => article.id === evidenceId));
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
