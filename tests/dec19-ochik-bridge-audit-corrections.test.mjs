import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7cx0xve969nh9zea7bwr02xh813g9n";
const khmerTimesId = "jn7dmsrs22e97251hw3431vb2d7xnaa1";
const unusableKohSantepheapId = "jn714eyc365mcq4wby9t41h4897xp27t";

test("Dec 19 O’Chik bridge strike is date-only and remains attributed", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-19");
  assert.equal(event.timeOfDay, "");
  assert.match(event.title, /^Khmer Times Reports/u);
  assert.match(event.description, /approximately 23:00/u);
  assert.match(event.description, /two F-16 fighter jets/u);
  assert.match(event.description, /three bombs/u);
  assert.match(event.description, /does not independently verify/u);
  assert.doesNotMatch(event.description, /18 civilians|79 injured/u);
  assert.deepEqual(event.evidenceIds, [khmerTimesId]);
  assert.equal(event.evidenceIds.includes(unusableKohSantepheapId), false);
});

test("Khmer Times summary stays within the captured bridge-strike report", () => {
  const article = readJsonl("data/news/2025-12.jsonl").find((row) => row.id === khmerTimesId);
  assert.ok(article);
  assert.match(article.summary, /approximately 23:00 on December 19/u);
  assert.match(article.summary, /three bombs/u);
  assert.match(article.summary, /70 km from the border/u);
  assert.match(article.summary, /not independently verified/u);
  assert.doesNotMatch(article.summary, /war crime/u);
});
