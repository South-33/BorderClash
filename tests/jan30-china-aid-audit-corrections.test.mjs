import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const id = "ks73an13bk893d7x61vmf6010n813wsb";

test("China aid milestone removes unsupported 15:00 and avoids first-aid ambiguity", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === id);
  assert.ok(event);
  assert.equal(event.date, "2026-01-30");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /First of Two Humanitarian Aid Shipments/u);
  assert.doesNotMatch(event.title, /First Aid Shipment/u);
});

test("shipment details match the captured Naewna report", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === id);
  for (const value of ["10 million yuan", "8,888", "10,000", "400", "4,000", "8,000", "15,000", "February 1"]) {
    assert.ok(event.description.includes(value), value);
  }
  assert.match(event.description, /does not state an exact handover time/u);
  assert.deepEqual(event.evidenceIds, ["js79tq3rr39zr18hhzv0h86a5x806wwv"]);
});

test("Thai and Khmer copies preserve shipment counts and exact-time limitation", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === id);
  for (const value of ["10", "8,888", "10,000", "400", "4,000", "8,000", "15,000", "1"]) {
    assert.ok(event.descriptionTh.includes(value), "Thai " + value);
    assert.ok(event.descriptionKh.includes(value), "Khmer " + value);
  }
  assert.match(event.descriptionTh, /ไม่ได้ระบุเวลารับมอบที่แน่นอน/u);
  assert.match(event.descriptionKh, /មិនបានបញ្ជាក់ម៉ោងប្រគល់ជាក់លាក់ទេ/u);
});
