import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const eventId = "ks7dhmxjf4vjm2fwd9rmqn2xy581kpfd";
const evidenceId = "js75fw5x8937azqjx4sgz3sen581jkz5";

test("February 20 border-fire summary removes unsupported 14:00", () => {
  const event = read("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-02-20");
  assert.equal(event.timeOfDay, undefined);
});

test("seven-fire geography and distance are not overstated", () => {
  const event = read("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /seven fire or hotspot locations/u);
  assert.match(event.description, /closest listed sites were about 500 metres/u);
  assert.doesNotMatch(event.description, /seven .*within 500 metres/u);
});

test("cause and control remain attributed and unsupported logistics claim is removed", () => {
  const event = read("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /Thai command's account/u);
  assert.match(event.description, /does not say the fires created logistical difficulties/u);
  assert.doesNotMatch(event.title, /Impact Military Standby/u);
});

test("stored Naewna summary also removes the unsupported logistics claim", () => {
  const article = read("data/news/2026-02.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.match(article.summary, /seven fire or hotspot locations/u);
  assert.doesNotMatch(article.summary, /logistical difficult|military standby/u);
});

test("Thai and Khmer copies preserve no exact event time", () => {
  const event = read("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  for (const value of [event.descriptionTh, event.descriptionKh]) {
    assert.ok(value.includes("7"));
    assert.ok(value.includes("500"));
    assert.ok(!value.includes("14:00"));
  }
});
