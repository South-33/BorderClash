import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const eventId = "ks716dwgvxj6d5hb08hswfggmn822nsp";
const evidenceId = "72c0a7203fce2751f3dc9662f0db4c74";
const blockedNationId = "de17d11e1df5dff0eba2c69b57fb4c8d";

test("February 28 fuel-control row removes unsupported 11:00 and uses captured Thai Rath evidence", () => {
  const event = read("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-02-28");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("fuel controls are stated precisely without treating diversion as established fact", () => {
  const event = read("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /GPS tracking of fuel tankers from origin to destination/u);
  assert.match(event.description, /officer checks of fuel type, volume and vehicles/u);
  assert.match(event.description, /reporting to the Suranaree Task Force/u);
  assert.match(event.description, /does not establish that fuel had actually been diverted/u);
  assert.match(event.description, /not an exact event time/u);
});

test("Thai and Khmer copies preserve controls, uncertainty, and no exact event time", () => {
  const event = read("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  for (const text of [event.descriptionTh, event.descriptionKh]) assert.match(text, /GPS/u);
  assert.match(event.descriptionTh, /ไม่ได้ยืนยันว่ามีน้ำมันถูกส่งต่อ/u);
  assert.match(event.descriptionTh, /ไม่ได้ระบุเวลาเกิดเหตุที่แน่นอน/u);
  assert.match(event.descriptionKh, /មិនបានបញ្ជាក់ថាប្រេងត្រូវបានបញ្ជូនបន្ត/u);
  assert.match(event.descriptionKh, /មិនបានផ្តល់ម៉ោងព្រឹត្តិការណ៍ជាក់លាក់ទេ/u);
});

test("captured replacement evidence is retained and blocked trial evidence is not", () => {
  const articles = read("data/news/2026-02.jsonl");
  const article = articles.find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.equal(article.source, "Thai Rath");
  assert.equal(article.credibility, 70);
  assert.equal(articles.some((row) => row.id === blockedNationId), false);
});
