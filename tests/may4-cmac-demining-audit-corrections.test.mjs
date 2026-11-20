import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7bscwcj4hjvxs4sv664w24nd863vwv";
const evidenceId = "jn7azfrv05184hargxvtdmc3vd862mpr";

test("May 4 CMAC assessment is date-only and scopes the 85% figure to residential areas", () => {
  const event = readJsonl("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-05-04");
  assert.equal(event.timeOfDay ?? "", "");
  assert.match(event.description, /85% of prioritized residential areas/u);
  assert.doesNotMatch(event.description, /85% of border homes/u);
  assert.doesNotMatch(event.description, /10:00/u);
});

test("the record distinguishes clearance progress from continuing farmland and border contamination", () => {
  const event = readJsonl("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /farmland and border areas remained heavily contaminated/u);
  assert.match(event.description, /would take years/u);
  assert.match(event.description, /2030/u);
  assert.match(event.descriptionTh, /พื้นที่เกษตรและแนวชายแดนยังมีการปนเปื้อนหนัก/u);
  assert.match(event.descriptionKh, /ដីកសិកម្ម និងតំបន់ព្រំដែននៅតែមានការបំពុលខ្លាំង/u);
});

test("cluster-munition responsibility claims stay attributed to Cambodian authorities", () => {
  const event = readJsonl("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /remain attributed to Cambodian authorities/u);
  assert.match(event.descriptionTh, /เป็นจุดยืนของหน่วยงานกัมพูชา/u);
  assert.match(event.descriptionKh, /ជាជំហររបស់អាជ្ញាធរកម្ពុជា/u);
});

test("evidence registry summary reflects the captured CMAC assessment", () => {
  const article = readJsonl("data/news/2026-05.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.equal(article.category, "humanitarian");
  assert.match(article.summary, /85% of prioritized residential areas/u);
  assert.match(article.summary, /2030 mine-free goal/u);
  assert.match(article.summary, /attribution/u);
});
