import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7c4342ys0ebg5hkfpfdaaqpd865agw";
const evidenceId = "jn7e3q3hpxv7ghf4x9qmmvxs49864zg7";

test("May 5 housing milestone preserves the source's approximate count and removes the invented time", () => {
  const event = readJsonl("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-05-05");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Nearly 3,000 Temporary Housing Units/u);
  assert.match(event.description, /nearly 3,000 temporary housing units/u);
  assert.match(event.description, /about 600 units in Preah Vihear/u);
  assert.match(event.description, /more than 200 in Oddar Meanchey/u);
  assert.match(event.description, /2,805 families/u);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("Thai and Khmer housing copy keeps the same quantities and temporary-housing scope", () => {
  const event = readJsonl("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.titleTh, /เกือบ 3,000/u);
  assert.match(event.descriptionTh, /ประมาณ 600/u);
  assert.match(event.descriptionTh, /มากกว่า 200/u);
  assert.match(event.descriptionTh, /2,805 ครอบครัว/u);
  assert.match(event.titleKh, /ជិត 3,000/u);
  assert.match(event.descriptionKh, /ប្រហែល 600/u);
  assert.match(event.descriptionKh, /ជាង 200/u);
  assert.match(event.descriptionKh, /2,805 គ្រួសារ/u);
});
