import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const eventId = "ks7fxabgq25tfg5entb4kp4eb587evna";
const evidenceId = "js7eebmxg29tcred5yy23bx4x187f2s3";

test("Huay Ta Maria record preserves two reported burst times without inventing one event time", () => {
  const event = read("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-05-24");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(event.status, "unverified");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.description, /19:59/u);
  assert.match(event.description, /20:10/u);
  assert.doesNotMatch(event.description, /22:00/u);
});

test("shot attribution and motive remain explicitly unverified Thai military reporting", () => {
  const event = read("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /Thai military attributed/u);
  assert.match(event.description, /motive was difficult to establish/u);
  assert.match(event.description, /does not independently verify who fired or why/u);
});

test("Thai and Khmer copies preserve both times and evidence boundary", () => {
  const event = read("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  for (const value of ["19:59", "20:10", "4", "5"]) {
    assert.ok(event.descriptionTh.includes(value.replace(":", ".")) || event.descriptionTh.includes(value), "Thai " + value);
    assert.ok(event.descriptionKh.includes(value), "Khmer " + value);
  }
  assert.match(event.descriptionTh, /ไม่ได้ยืนยันโดยอิสระ/u);
  assert.match(event.descriptionKh, /មិនបានបញ្ជាក់ដោយឯករាជ្យ/u);
});

test("Naewna row is scored as an attributed conflict-party report", () => {
  const article = read("data/news/2026-05.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.equal(article.status, "active");
  assert.equal(article.credibility, 60);
  assert.match(article.summary, /Thai 2nd Army Region's account/u);
  assert.match(article.summary, /does not independently verify/u);
});
