import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7ae96k6bpngy1v4h3j1v1rax8126wm";
const evidenceId = "830be225168e7269d17495be96b56782";
const row = () => readFileSync("data/timeline/2025-12.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse).find((r) => r.id === id);

test("Dec 29 Interior Ministry GBC meeting uses captured English mirror", () => {
  const event = row();
  assert.ok(event);
  assert.equal(event.date, "2025-12-29");
  assert.equal(event.timeOfDay, "13:30");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.title, /Seven Border Governors/u);
  assert.match(event.description, /72-hour ceasefire monitoring period/u);
});

test("Dec 29 GBC implementation record preserves chronology", () => {
  const event = row();
  assert.match(event.description, /end at 12:00 on December 30/u);
  assert.match(event.description, /safely and with dignity/u);
  assert.doesNotMatch(event.description, /as the 72-hour window expired/u);
});
