import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7bdvf56waq1y5bzd8tjavns98134rw";
const evidenceId = "js728mjt7y8czpr6kbgjttrpbh7z9yva";
const rows = readFileSync("data/timeline/2026-01.jsonl", "utf8")
  .trim()
  .split(/\r?\n/u)
  .map(JSON.parse);
const event = rows.find((item) => item.id === id);
const news = readFileSync("data/news/2026-01.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const evidence = news.find((item) => item.id === evidenceId);

test("Jan 1 Second Army row separates reinforcement, UAV and route-work claims", () => {
  assert.equal(event.date, "2026-01-01");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.description, /reinforcing several Si Sa Ket sectors/u);
  assert.match(event.description, /UAV reconnaissance around Phu Ma Khuea/u);
  assert.match(event.description, /routes toward Hill 745 and Yod Dome/u);
  assert.match(event.description, /no significant movement at Chong Bok, Chong An Ma/u);
  assert.match(event.description, /Thai Second Army Region's account/u);
  assert.doesNotMatch(event.description, /reinforcing strategic heights at Hill 745/u);
  assert.doesNotMatch(event.description, /18:00/u);
  assert.match(evidence.summary, /route improvements in rear areas toward Hill 745 and Yod Dome/u);
  assert.match(evidence.summary, /no significant movement at Chong Bok, Chong An Ma/u);
  assert.doesNotMatch(evidence.summary, /Hill 745 and Chong Bok/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
