import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7ezgrg2v2ewvbnvfc87aya61813500";
const evidenceIds = ["jn7a9j079ekdmcpjdrjks37bvn7xav4t", "jn72hx5hb3pt5ytkcqh4qsv6jd7xayy4"];
const rows = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const event = rows.find((item) => item.id === id);

test("Dec 15 toxic-drone row uses the reported 12:56 incident time and explicit allegation framing", () => {
  assert.equal(event.date, "2025-12-15");
  assert.equal(event.timeOfDay, "12:56");
  assert.equal(event.status, "unverified");
  assert.deepEqual(event.evidenceIds, evidenceIds);
  assert.match(event.title, /Alleges Drone-Sprayed/u);
  assert.match(event.description, /at 12:56/u);
  assert.match(event.description, /do not independently verify the substance used/u);
  assert.doesNotMatch(event.description, /13:30 shown in the Khmer Times headline|captured publisher text/u);
  assert.doesNotMatch(event.description, /escalating accusations of unconventional warfare/u);
  assert.doesNotMatch(`${event.titleTh}${event.descriptionTh}${event.titleKh}${event.descriptionKh}`, /�/u);
});
