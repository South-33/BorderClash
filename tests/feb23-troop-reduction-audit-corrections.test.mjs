import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks70ks1vzc258aqqjc1gf4p0x981skbs";
const rows = readFileSync("data/timeline/2026-02.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);
const news = readFileSync("data/news/2026-02.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const evidence = news.find((item) => item.id === "js7c1yesxe1syahpvq2at74r1581rpnp");

test("Feb 23 troop reduction row follows the captured Thai PBS proposal", () => {
  assert.equal(event.date, "2026-02-23");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Gradual Border Troop Reduction/u);
  assert.match(event.description, /to the Defence Council to reduce costs/u);
  assert.match(event.description, /electronic monitoring in populated border areas/u);
  assert.match(event.description, /villages for war veterans/u);
  assert.match(event.description, /Chong An Ma, Chong Bok and Phu Makua/u);
  assert.doesNotMatch(event.description, /replace human presence with electronic monitoring/u);
  assert.doesNotMatch(event.description, /10:00/u);
  assert.match(evidence.summary, /Khlong Luek and opposite Thmor Da/u);
  assert.match(evidence.summary, /Chong An Ma, Chong Bok and Phu Makua could eventually be developed as tourist attractions/u);
  assert.doesNotMatch(evidence.summary, /recaptured in December, such as Chong An Ma and Phu Makua/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
