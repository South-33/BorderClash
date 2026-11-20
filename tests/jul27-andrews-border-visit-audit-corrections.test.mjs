import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7ctfwymkfhwgs9pb0yq5wkjs8bhja2";
const evidenceId = "jn7e99wtz0dsd9aj4zvhhmme218bgnh2";

test("July 27 Andrews milestone keeps the supported date and removes invented time", () => {
  const event = readJsonl("data/timeline/2026-07.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-07-27");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Visits Boeung Trakuon Border Area/u);
  assert.match(event.description, /Tom Andrews/u);
  assert.match(event.description, /Oum Reatrey/u);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("border-fortification claim stays attributed to Cambodian officials", () => {
  const event = readJsonl("data/timeline/2026-07.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /Cambodian officials showed him an area where they said/u);
  assert.match(event.description, /shipping containers and razor wire/u);
  assert.doesNotMatch(event.description, /met with displaced residents/u);
});

test("Thai and Khmer copy preserve actor, place, and attribution", () => {
  const event = readJsonl("data/timeline/2026-07.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.descriptionTh, /ทอม แอนดรูว์ส/u);
  assert.match(event.descriptionTh, /ฝ่ายกัมพูชาระบุ/u);
  assert.match(event.descriptionKh, /Tom Andrews/u);
  assert.match(event.descriptionKh, /មន្ត្រីកម្ពុជា/u);
  assert.match(event.descriptionKh, /ពួកគេនិយាយថា/u);
});

test("Khmer Times summary no longer upgrades Cambodian barrier claims to fact", () => {
  const article = readJsonl("data/news/2026-07.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.match(article.summary, /Cambodian officials showed him an area where they said/u);
  assert.match(article.summary, /July 27/u);
  assert.doesNotMatch(article.summary, /meeting with displaced communities/u);
});
