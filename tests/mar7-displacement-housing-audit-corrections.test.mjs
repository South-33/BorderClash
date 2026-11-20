import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const timeline = readJsonl("data/timeline/2026-03.jsonl");
const news = readJsonl("data/news/2026-03.jsonl");

test("March 7 displacement row is a 06:00 population snapshot, not a reconstruction composite", () => {
  const event = timeline.find((row) => row.id === "ks70ck84jvhh4sqtx2t5tt39jn82g1e0");
  assert.ok(event);
  assert.equal(event.date, "2026-03-07");
  assert.equal(event.timeOfDay, "06:00");
  assert.deepEqual(event.evidenceIds, ["jn7av176dmhpynjj9mps0whngs82gm33"]);
  assert.match(event.description, /332 displaced people/u);
  assert.match(event.description, /nearly 93%/u);
  assert.match(event.description, /46,394/u);
  assert.match(event.description, /24,326 women/u);
  assert.match(event.description, /15,358 children/u);
  assert.doesNotMatch(event.description, /repairing infrastructure|newly built houses/u);
});

test("March 7 Oddar Meanchey row preserves the separate 203-house allocation event", () => {
  const event = timeline.find((row) => row.id === "ks72xmx6y4cby6hqw74m1796cs82gdya");
  assert.ok(event);
  assert.equal(event.date, "2026-03-07");
  assert.equal(event.timeOfDay, "");
  assert.deepEqual(event.evidenceIds, [
    "jn7a7pc9d35ayvgy4ffkk1w0cs82gxeg",
    "k970jxjq31mvy7716wq98d6jex82htc3",
  ]);
  assert.match(event.description, /lottery ceremony/u);
  assert.match(event.description, /203 newly built houses/u);
  assert.match(event.description, /Samraong city and Banteay Ampil district/u);
  assert.match(event.description, /attributed claims of Thai military encirclement or occupation/u);
});

test("Thai and Khmer copy preserve the March 7 numbers and attribution", () => {
  const displaced = timeline.find((row) => row.id === "ks70ck84jvhh4sqtx2t5tt39jn82g1e0");
  const housing = timeline.find((row) => row.id === "ks72xmx6y4cby6hqw74m1796cs82gdya");
  assert.ok(displaced && housing);
  for (const text of [displaced.descriptionTh, displaced.descriptionKh]) {
    assert.match(text, /06:00/u);
    assert.match(text, /332/u);
    assert.match(text, /93%/u);
    assert.match(text, /46,394/u);
    assert.match(text, /24,326/u);
    assert.match(text, /15,358/u);
  }
  for (const text of [housing.descriptionTh, housing.descriptionKh]) {
    assert.match(text, /203/u);
    assert.match(text, /7/u);
  }
  assert.match(housing.descriptionTh, /คำกล่าว|ข้อกล่าวหา/u);
  assert.match(housing.descriptionKh, /ការអះអាង/u);
});

test("Khmer Times housing summary keeps territorial claims attributed", () => {
  const article = news.find((row) => row.id === "k970jxjq31mvy7716wq98d6jex82htc3");
  assert.ok(article);
  assert.match(article.summary, /March 7 Oddar Meanchey housing allocation/u);
  assert.match(article.summary, /attributed claims/u);
  assert.match(article.summary, /3,000 temporary shelters/u);
});
