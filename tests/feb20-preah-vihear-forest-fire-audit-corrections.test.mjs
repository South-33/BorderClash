import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const eventId = "ks70x1p1ds9ha2w9m36pdhcbg181hdke";
const siamNewsId = "836690a5dd8b2a16a01ed30192d0131d";

test("February 20 forest-fire milestone uses the captured 01:20 Preah Vihear report", () => {
  const event = read("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-02-20");
  assert.equal(event.timeOfDay, "01:20");
  assert.equal(event.status, "unverified");
  assert.deepEqual(event.evidenceIds, [siamNewsId]);
  assert.match(event.description, /about 113 homes burned/u);
});

test("cause remains attributed and unsupported conflated details are removed", () => {
  const event = read("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /Facebook page claimed/u);
  assert.match(event.description, /had not been officially confirmed/u);
  assert.match(event.description, /does not support the prior 12:00 time/u);
  assert.match(event.description, /60-home Battambang count/u);
  assert.match(event.description, /timber-factory damage/u);
});

test("Thai and Khmer copies preserve 01:20, 113, 12:00, 60, and uncertainty", () => {
  const event = read("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  for (const value of ["01:20", "113", "12:00", "60"]) {
    assert.ok(event.descriptionTh.includes(value), "Thai " + value);
    assert.ok(event.descriptionKh.includes(value), "Khmer " + value);
  }
  assert.match(event.descriptionTh, /ยังไม่ได้รับการยืนยันอย่างเป็นทางการ/u);
  assert.match(event.descriptionKh, /មិនទាន់ត្រូវបានបញ្ជាក់ជាផ្លូវការ/u);
});

test("new Siam News evidence row keeps the cause as an attributed unconfirmed claim", () => {
  const article = read("data/news/2026-02.jsonl").find((row) => row.id === siamNewsId);
  assert.ok(article);
  assert.equal(article.credibility, 50);
  assert.match(article.summary, /Facebook page attributed/u);
  assert.match(article.summary, /had not been officially confirmed/u);
});
