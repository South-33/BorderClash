import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("December 28 ceasefire row is a next-day status update without invented time", () => {
  const rows = readJsonl("data/timeline/2025-12.jsonl");
  const event = rows.find((row) => row.id === "ks7danh56sm2fw9kqv00rm22kx812ge8");
  const signing = rows.find((row) => row.id === "ks7bj3fvt1qh73xyperhk06shh8123ve");

  assert.ok(event);
  assert.ok(signing);
  assert.equal(event.date, "2025-12-28");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /no reports of gunfire/u);
  assert.match(event.description, /Maly Socheata separately said/u);
  assert.match(event.description, /next-day implementation update/u);
  assert.equal(signing.date, "2025-12-27");
  assert.equal(signing.timeOfDay, "12:00");
});
