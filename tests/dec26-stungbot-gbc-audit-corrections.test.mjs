import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const timelineId = "ks72h3v1awbh68pwjh8vfrwz5n812brx";
const shellingEvidenceId = "eca5ab27ed18e615ff37a62994b0c972";
const timeline = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = timeline.find((item) => item.id === timelineId);

test("Dec 26 Stung Bot row tracks only the supported 09:59 shelling milestone", () => {
  assert.equal(event.date, "2025-12-26");
  assert.equal(event.timeOfDay, "09:59");
  assert.deepEqual(event.evidenceIds, [shellingEvidenceId]);
  assert.match(event.description, /six 155mm artillery shells/u);
  assert.match(event.description, /between 09:59 and 10:53/u);
  assert.match(event.description, /Cambodia's official claims/u);
  assert.doesNotMatch(event.title + event.description, /GBC|meeting|09:46|two 155mm|Malaysia/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /\uFFFD/u);
});
