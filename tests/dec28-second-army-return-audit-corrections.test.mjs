import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7f9avvthewjrqpbjke6k577h813kdz";
const articleId = "js7149d8jqcjsp3z47n60cyvgd7y5rez";

test("Dec 28 return-home milestone records the 2nd Army Region announcement without invented actors or time", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-28");
  assert.equal(event.timeOfDay, "");
  assert.equal(event.title, "2nd Army Region Says Residents Can Return Home After Ceasefire");
  assert.deepEqual(event.evidenceIds, [articleId]);
  assert.match(event.description, /2nd Army Region/u);
  assert.match(event.description, /December 27 ceasefire/u);
  assert.match(event.description, /remain cautious/u);
  assert.doesNotMatch(event.description, /Anutin|Buriram|Belarus|thousands|10:30/iu);
  assert.doesNotMatch(event.descriptionTh, /อนุทิน|บุรีรัมย์|เบลารุส|10:30/u);
  assert.doesNotMatch(event.descriptionKh, /Anutin|Buriram|Belarus|10:30/iu);
});

test("Naewna evidence remains a Dec 28 15:25 publication about residents returning home", () => {
  const article = readJsonl("data/news/2025-12.jsonl").find((row) => row.id === articleId);
  assert.ok(article);
  assert.equal(new Date(article.publishedAt).toISOString(), "2025-12-28T08:25:00.000Z");
  assert.match(article.titleEn, /2nd Army Region announces residents can return to their homes/u);
  assert.match(article.summary, /permitted to return to their homes/u);
  assert.doesNotMatch(article.summary, /Anutin|Buriram|Belarus|10:30/iu);
});
