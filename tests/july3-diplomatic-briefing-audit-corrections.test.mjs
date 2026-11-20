import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const briefingId = "ks7bn5e4yt0bw1jqnd631efn3x8b51qw";
const conflatedId = "ks70z7be7wq35ps9gkr85paq6d8a1wgz";
const july2Id = "ks78m1fz93j97brkfrsxxbx9ad89w8s0";
const july4Id = "ks73mmhf0z8f16v2jd6yzg2g9h89x154";
const starId = "k978sdc7z6af30y7etq79yh8k98a3fc7";
const cambodianessId = "b006f0ebd239c0658befd7b9e2b949a9";
const provenanceId = "cambodia-mfa-july3-diplomatic-briefing";

test("diplomatic briefing is correctly dated July 3 and date-only", () => {
  const timeline = readJsonl("data/timeline/2026-07.jsonl");
  const event = timeline.find((row) => row.id === briefingId);
  assert.ok(event);
  assert.equal(event.date, "2026-07-03");
  assert.equal(event.timeOfDay ?? "", "");
  assert.match(event.title, /Briefs 42 Missions/u);
  assert.match(event.description, /On July 3/u);
  assert.match(event.description, /42 representatives/u);
  assert.match(event.description, /Joint Boundary Commission/u);
});

test("conflated July 5 wrapper is removed while July 2 and July 4 records remain", () => {
  const timeline = readJsonl("data/timeline/2026-07.jsonl");
  assert.equal(timeline.some((row) => row.id === conflatedId), false);
  assert.ok(timeline.some((row) => row.id === july2Id));
  assert.ok(timeline.some((row) => row.id === july4Id));
});

test("briefing claims remain attributed in English Thai and Khmer", () => {
  const event = readJsonl("data/timeline/2026-07.jsonl").find((row) => row.id === briefingId);
  assert.ok(event);
  assert.match(event.description, /remain Cambodia's position/u);
  assert.match(event.descriptionTh, /ยังเป็นจุดยืนของกัมพูชา/u);
  assert.match(event.descriptionKh, /នៅតែជាជំហររបស់កម្ពុជា/u);
});

test("readable briefing reports share one Cambodian MFA provenance chain", () => {
  const articles = readJsonl("data/news/2026-07.jsonl");
  const star = articles.find((row) => row.id === starId);
  const cambodianess = articles.find((row) => row.id === cambodianessId);
  assert.ok(star);
  assert.ok(cambodianess);
  assert.equal(star.provenanceId, provenanceId);
  assert.equal(cambodianess.provenanceId, provenanceId);
  assert.match(star.summary, /July 3/u);
  assert.match(cambodianess.summary, /July 3/u);
  assert.equal(new Date(cambodianess.publishedAt).toISOString(), "2026-07-06T12:15:00.000Z");
});
