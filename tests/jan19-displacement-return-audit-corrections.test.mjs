import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7ddadj2pssxscm3t56d0sv99812wyp";
const row = () => readFileSync("data/timeline/2026-01.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse).find((r) => r.id === id);

test("Jan 19 displacement return status is grounded in the captured Interior Ministry figures", () => {
  const event = row();
  assert.ok(event);
  assert.equal(event.date, "2026-01-19");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /510,000/u);
  assert.match(event.description, /3,041/u);
  assert.match(event.description, /134,731/u);
  assert.match(event.description, /70,460 women/u);
  assert.match(event.description, /43,903 children/u);
});

test("Jan 19 displacement return status keeps source attribution and no invented exact time", () => {
  const event = row();
  assert.match(event.description, /citing Cambodia's Interior Ministry/u);
  assert.match(event.description, /no exact event time/u);
});
