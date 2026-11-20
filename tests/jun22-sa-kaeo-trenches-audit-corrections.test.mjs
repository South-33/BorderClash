import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7esq7aw3cv0j9cm3qmbad1w9894qgc";
const articleId = "k975q9bzh7b6r3es5dbr5yagt589464t";

test("June 22 trench report removes invented time and attributes the observation", () => {
  const event = readJsonl("data/timeline/2026-06.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-06-22");
  assert.equal(event.timeOfDay, "");
  assert.deepEqual(event.evidenceIds, [articleId]);
  assert.match(event.title, /Thai Residents Report/u);
  assert.match(event.description, /residents in Ban Nong Chan/u);
  assert.match(event.description, /for several days/u);
  assert.match(event.description, /less than 20 metres from the border fence/u);
  assert.match(event.description, /not independent proof/u);
});

test("Thai and Khmer copy keep the reporting attribution and no-clash context", () => {
  const event = readJsonl("data/timeline/2026-06.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.descriptionTh, /ชาวบ้านบ้านหนองจาน/u);
  assert.match(event.descriptionTh, /ยังไม่มีการปะทะ/u);
  assert.match(event.descriptionKh, /ប្រជាពលរដ្ឋនៅភូមិណងចាន់/u);
  assert.match(event.descriptionKh, /មិនមានការប៉ះទង្គិច/u);
  for (const text of [event.descriptionTh, event.descriptionKh]) {
    assert.match(text, /20/u);
    assert.doesNotMatch(text, /���|\?{3,}/u);
  }
});

test("Khaosod article remains an attributed single-source military report", () => {
  const article = readJsonl("data/news/2026-06.jsonl").find((row) => row.id === articleId);
  assert.ok(article);
  assert.equal(article.credibility, 60);
  assert.match(article.summary, /residents in Ban Nong Chan/u);
  assert.match(article.summary, /for several days/u);
  assert.match(article.summary, /no clashes or confrontations/u);
  assert.match(article.summary, /not independent proof/u);
});
