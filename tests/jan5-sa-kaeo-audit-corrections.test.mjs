import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const id = "ks7anyr4cp918ysbf6xfe423cn8132f1";
const evidenceId = "69e59d88acb7bcb4d5091e1096f04bef";

test("Sa Kaeo record removes unsupported 10:00 and uses captured JS100 evidence", () => {
  const event = read("data/timeline/2026-01.jsonl").find((row) => row.id === id);
  assert.ok(event);
  assert.equal(event.date, "2026-01-05");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("First Army progress and territorial claims stay attributed", () => {
  const event = read("data/timeline/2026-01.jsonl").find((row) => row.id === id);
  assert.match(event.description, /First Army Area said/u);
  assert.match(event.description, /four villages/u);
  assert.match(event.description, /Ban Nong Chan and Ban Nong Ya Kaew/u);
  assert.match(event.description, /territorial characterization is Thailand's military position/u);
  assert.match(event.description, /not independently established/u);
});

test("Thai and Khmer copies preserve three sites, four villages and attribution boundary", () => {
  const event = read("data/timeline/2026-01.jsonl").find((row) => row.id === id);
  for (const value of ["3", "4", "27"]) {
    assert.ok(event.descriptionTh.includes(value), "Thai " + value);
    assert.ok(event.descriptionKh.includes(value), "Khmer " + value);
  }
  assert.match(event.descriptionTh, /จุดยืนของฝ่ายทหารไทย/u);
  assert.match(event.descriptionKh, /ជំហររបស់យោធាថៃ/u);
});
