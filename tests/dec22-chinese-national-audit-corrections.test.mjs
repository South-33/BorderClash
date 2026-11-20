import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7crsfgsmqj0vk2r40c59r955813dqq";
const embassyId = "1f3fce86ed389ae3cf70cea124161d1f";

test("Dec 22 Chinese-national injury keeps the supported date but no invented exact time", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-22");
  assert.equal(event.timeOfDay, "");
  assert.equal(event.title, "Chinese Embassy Verifies Citizen Slightly Injured in Battambang Shelling");
  assert.deepEqual(event.evidenceIds, [embassyId]);
  assert.match(event.description, /slightly injured by shellfire/u);
  assert.match(event.description, /verified the case through the person's company/u);
  assert.match(event.description, /did not give an exact incident time/u);
});

test("Dec 22 correction removes the conflated district chronology and unsupported first-casualty claim", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const text of [event.title, event.description, event.titleTh, event.descriptionTh, event.titleKh, event.descriptionKh]) {
    assert.doesNotMatch(text, /first confirmed|first foreign|Sampov Loun|Phnom Prek|สำเภาลูน|พนมพฤกษ์|សំពៅលូន|ភ្នំព្រឹក/iu);
  }
  for (const value of ["22"]) {
    assert.ok(event.descriptionTh.includes(value), `Thai: ${value}`);
    assert.ok(event.descriptionKh.includes(value), `Khmer: ${value}`);
  }
});

test("direct Chinese Embassy evidence confirms a slight injury without an incident time", () => {
  const article = readJsonl("data/news/2025-12.jsonl").find((row) => row.id === embassyId);
  assert.ok(article);
  assert.equal(article.source, "Embassy of China in Cambodia");
  assert.equal(article.credibility, 100);
  assert.match(article.sourceUrl, /china-embassy\.gov\.cn/u);
  assert.match(article.summary, /slightly injured by shellfire/u);
  assert.match(article.summary, /does not give an exact incident time/u);
});
