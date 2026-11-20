import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const id = "ks715zt5dks32xcqwhs0tg60rn812snx";

test("December 20 Thai ASEAN position has no unsupported exact time", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === id);
  assert.ok(event);
  assert.equal(event.date, "2025-12-20");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(event.category, "diplomatic");
  assert.deepEqual(event.evidenceIds, ["js750qfyecwxsn5xcs5b04s4r17xma7j"]);
});

test("record keeps the Foreign Ministry statement separate from Army allegations", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === id);
  assert.match(event.description, /Maratee Nalita Andamo/u);
  assert.match(event.description, /December 22/u);
  assert.match(event.description, /Thailand's stated diplomatic positions/u);
  assert.match(event.description, /does not independently establish/u);
  assert.doesNotMatch(event.description, /BM-21|rocket attacks on hospitals|condemned Cambodian/u);
});

test("Thai and Khmer copies preserve dates and attribution boundary", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === id);
  for (const value of ["20", "22"]) {
    assert.ok(event.descriptionTh.includes(value), "Thai " + value);
    assert.ok(event.descriptionKh.includes(value), "Khmer " + value);
  }
  assert.match(event.descriptionTh, /จุดยืนทางการทูตของไทย/u);
  assert.match(event.descriptionKh, /ជំហរទូតរបស់ថៃ/u);
});
