import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const eventId = "ks77veh820eqct5vxy9mx1gfjx812vnj";
const freshId = "jn7em2jyfb27331pb9rfr3tms17xffed";
const khmerTimesId = "jn7eea9j9hzbzxvkhyt7tz7v2s7xf2t6";

test("Boeung Trakuon milestone no longer asserts an unsupported retaking or 09:00 time", () => {
  const event = read("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-11");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(event.status, "unverified");
  assert.deepEqual(event.evidenceIds, [khmerTimesId]);
  assert.doesNotMatch(event.title, /Retakes|Reclaims/u);
});

test("timeline keeps the Cambodian Defence Ministry account attributed", () => {
  const event = read("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /at about 11:00/u);
  assert.match(event.description, /BM-21 rockets there at 09:50/u);
  assert.match(event.description, /Cambodian Defence Ministry claims/u);
  assert.match(event.description, /does not independently establish territorial control/u);
});

test("headline-only Fresh News row is downgraded and not used as timeline evidence", () => {
  const news = read("data/news/2025-12.jsonl");
  const fresh = news.find((row) => row.id === freshId);
  const kt = news.find((row) => row.id === khmerTimesId);
  assert.ok(fresh && kt);
  assert.equal(fresh.status, "unverified");
  assert.equal(fresh.credibility, 40);
  assert.match(fresh.summary, /headline/u);
  assert.match(fresh.summary, /not used as canonical timeline evidence/u);
  assert.equal(kt.credibility, 60);
  assert.match(kt.summary, /Cambodian official claims/u);
});

test("Thai and Khmer copies preserve attribution and both reported times", () => {
  const event = read("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  for (const value of ["11", "09:50", "BM-21"]) {
    assert.ok(event.descriptionTh.includes(value) || event.descriptionTh.includes(value.replace(":", ".")), "Thai " + value);
    assert.ok(event.descriptionKh.includes(value), "Khmer " + value);
  }
  assert.match(event.descriptionTh, /คำกล่าวของกระทรวงกลาโหมกัมพูชา/u);
  assert.match(event.descriptionKh, /ការអះអាងរបស់ក្រសួងការពារជាតិកម្ពុជា/u);
});
