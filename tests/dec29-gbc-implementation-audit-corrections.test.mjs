import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7ae96k6bpngy1v4h3j1v1rax8126wm";
const row = () => readFileSync("data/timeline/2025-12.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse).find((r) => r.id === id);

test("Dec 29 GBC implementation meeting uses captured event time", () => {
  const event = row();
  assert.ok(event);
  assert.equal(event.date, "2025-12-29");
  assert.equal(event.timeOfDay, "13:30");
  assert.deepEqual(event.evidenceIds, ["830be225168e7269d17495be96b56782"]);
  assert.match(event.description, /seven Thai-Cambodian border provinces/u);
  assert.match(event.description, /72-hour ceasefire monitoring period/u);
});

test("Dec 29 GBC row keeps Thai and Khmer localization intact", () => {
  const event = row();
  assert.match(event.titleTh, /[\u0E00-\u0E7F]/u);
  assert.match(event.titleKh, /[\u1780-\u17FF]/u);
  assert.doesNotMatch(event.titleTh, /\?{3,}/u);
  assert.doesNotMatch(event.titleKh, /\?{3,}/u);
});
