import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7bbdgdnnb5bf2x09qjhwvha18191hz";
const evidenceIds = ["2b4c5113c0c44e550cae6cd24b32a04d", "214eee7078aca3412e47ca67616cdab8"];
const rows = () => readFileSync("data/timeline/2026-02.jsonl", "utf8").split(String.fromCharCode(10)).map((line) => line.trim()).filter(Boolean).map(JSON.parse);

test("Feb 14 vessel row keeps the captured 16:25 report time", () => {
  const event = rows().find((row) => row.id === id);
  assert.ok(event);
  assert.equal(event.date, "2026-02-14");
  assert.equal(event.timeOfDay, "16:25");
  assert.deepEqual(event.evidenceIds, evidenceIds);
});

test("vessel row attributes the seizure and preserves ownership uncertainty", () => {
  const event = rows().find((row) => row.id === id);
  assert.match(event.title, /Thai Navy Reports/u);
  assert.match(event.description, /Thai PBS, citing Royal Thai Navy spokesperson/u);
  assert.match(event.description, /former Thai licence had expired/u);
  assert.match(event.description, /sold to a Cambodian national/u);
  assert.match(event.description, /continue checking the report/u);
  assert.match(event.description, /remain attributed/u);
});

test("localized copies preserve the supported date and time", () => {
  const event = rows().find((row) => row.id === id);
  for (const value of [event.descriptionTh, event.descriptionKh]) {
    assert.ok(value.includes("14"));
    assert.ok(value.includes("16:25"));
  }
});
