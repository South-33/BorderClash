import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const eventId = "ks7a9x6aahxt2fx8evb67qmpvd85tm2b";
const starId = "js7anjkv8d00nrsa6921rv4bqx85trnd";

test("Chong Chom incident removes planned 10:00 as the canonical event time", () => {
  const event = read("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-04-29");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(event.status, "unverified");
  assert.deepEqual(event.evidenceIds, [starId]);
});

test("timeline preserves both Cambodian gunfire allegation and Thai firecracker denial", () => {
  const event = read("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /Cambodian authorities alleged/u);
  assert.match(event.description, /five firing incidents between about 10:35 and 11:09/u);
  assert.match(event.description, /three firecrackers as warning signals/u);
  assert.match(event.description, /around 10:30/u);
  assert.match(event.description, /competing official accounts/u);
  assert.match(event.description, /does not independently determine/u);
});

test("Thai and Khmer copies preserve the numerical and attribution conflict", () => {
  const event = read("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  for (const value of ["5", "10:35", "11:09", "3", "10:30"]) {
    const thaiValue = value.replaceAll(":", ".");
    assert.ok(event.descriptionTh.includes(thaiValue) || event.descriptionTh.includes(value), "Thai " + value);
    assert.ok(event.descriptionKh.includes(value), "Khmer " + value);
  }
  assert.match(event.descriptionTh, /คำกล่าวที่ขัดแย้งกัน/u);
  assert.match(event.descriptionKh, /គណនីផ្លូវការដែលផ្ទុយគ្នា/u);
});
