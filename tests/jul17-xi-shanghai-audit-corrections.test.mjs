import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks778msyvb2rya3sf00dheev318c5kmj";

test("Xi Shanghai meetings retain July 17 but no invented exact time", () => {
  const event = readJsonl("data/timeline/2026-07.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-07-17");
  assert.equal(Object.hasOwn(event, "timeOfDay"), false);
  assert.match(event.description, /separate meetings in Shanghai/u);
  assert.match(event.description, /Anutin Charnvirakul/u);
  assert.match(event.description, /Hun Manet/u);
  assert.match(event.description, /dialogue and consultation/u);
});

test("localized copy preserves both leaders and peaceful-dialogue framing", () => {
  const event = readJsonl("data/timeline/2026-07.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.descriptionTh, /\u0e2d\u0e19\u0e38\u0e17\u0e34\u0e19/u);
  assert.match(event.descriptionTh, /\u0e2e\u0e38\u0e19 \u0e21\u0e32\u0e41\u0e19\u0e15/u);
  assert.match(event.descriptionTh, /[\u0e00-\u0e7f]/u);
  assert.match(event.descriptionKh, /Anutin Charnvirakul/u);
  assert.match(event.descriptionKh, /[\u1780-\u17ff]/u);
  for (const text of [event.descriptionTh, event.descriptionKh]) {
    assert.doesNotMatch(text, /\uFFFD|\?{3,}/u);
  }
});