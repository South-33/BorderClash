import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks74kgs9ys9kpf969cqbj7p3an813mba";
const evidenceId = "jn74yeppbk4mbtwpk8jb70g8e17ydkdh";
const rows = readFileSync("data/timeline/2026-01.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("Jan 1 Cambodian frontline row is separated from the Thai reinforcement update", () => {
  assert.equal(event.date, "2026-01-01");
  assert.equal(event.timeOfDay, "08:00");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.title, /Frontline Quiet at 08:00/u);
  assert.match(event.description, /frontline situation was quiet/u);
  assert.match(event.description, /Cambodian Defence Ministry's account/u);
  assert.match(event.description, /Reinforcement and logistics claims.*separate Jan 1 timeline record/u);
  assert.doesNotMatch(event.title, /ICRC|Reinforcements/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
