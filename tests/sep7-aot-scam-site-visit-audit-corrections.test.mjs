import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const eventId = "ks73w9a3q0v6zz19k6n5ykdetd8e5dp9";
const evidenceId = "da504e588e865fd771c9d2cbdd994bf0";

test("AOT-media scam-site visit is dated to September 7 with no exact time", () => {
  const event = read("data/timeline/2026-09.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-09-07");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("row follows captured Thai MFA visit and drops uncaptured organ-trafficking claim", () => {
  const event = read("data/timeline/2026-09.jsonl").find((row) => row.id === eventId);
  assert.match(event.title, /Thai MFA Says JIC Led AOT and Media/u);
  assert.match(event.description, /51 Thai and foreign media and opinion leaders/u);
  assert.match(event.description, /does not establish organ trafficking/u);
  assert.doesNotMatch(event.title, /Organ Trafficking/u);
});

test("territorial and legal claims remain attributed to Thailand", () => {
  const event = read("data/timeline/2026-09.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /Thailand's official position/u);
  assert.match(event.description, /alleged that Cambodia/u);
});

test("Thai and Khmer copies remove the unsupported exact time", () => {
  const event = read("data/timeline/2026-09.jsonl").find((row) => row.id === eventId);
  for (const value of [event.descriptionTh, event.descriptionKh]) {
    assert.ok(value.includes("51"));
    assert.ok(!value.includes("10:00"));
  }
});

test("new MFA evidence is localized for the visible-news window", () => {
  const article = read("data/news/2026-09.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.ok(article.titleTh.includes("7"));
  assert.ok(article.titleKh.includes("7"));
  assert.doesNotMatch(article.summary, /organ trafficking|organ harvesting/u);
});
