import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks79378jff04hh9c7a8zmv09xs82yhwt";
const akpId = "24882142fa25b2d43649d13430b57ff1";
const bernamaId = "k97ab8t590axpgr0805xbqb5eh82yhdb";

test("fuel-station milestone uses the ministry notice date and no invented time", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-03-14");
  assert.equal(event.timeOfDay, "");
  assert.deepEqual(event.evidenceIds, [akpId, bernamaId]);
  assert.match(event.description, /as of March 13/u);
  assert.match(event.description, /more than 400 fuel stations and depots/u);
  assert.match(event.description, /more than 2,000 locations/u);
  assert.match(event.description, /new fuel stocks were arriving late/u);
  assert.doesNotMatch(event.description, /Thai-Cambodian border|border checkpoints|paralyzed regional fuel logistics/u);
});

test("Thai and Khmer copy preserve dates, counts and the supply-delay cause", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const text of [event.descriptionTh, event.descriptionKh]) {
    assert.match(text, /14/u);
    assert.match(text, /13/u);
    assert.match(text, /400/u);
    assert.match(text, /2,000/u);
    assert.doesNotMatch(text, /ด่านชายแดนไทย-กัมพูชา|ច្រកព្រំដែន.*ថៃ/u);
    assert.doesNotMatch(text, /���|\?{3,}/u);
  }
});

test("AKP and Bernama are one provenance chain, not independent corroboration", () => {
  const articles = readJsonl("data/news/2026-03.jsonl");
  const akp = articles.find((row) => row.id === akpId);
  const bernama = articles.find((row) => row.id === bernamaId);
  assert.ok(akp);
  assert.ok(bernama);
  assert.equal(akp.provenanceId, "mar14-commerce-fuel-stations");
  assert.equal(bernama.provenanceId, "mar14-commerce-fuel-stations");
  assert.equal(akp.credibility, 80);
  assert.equal(bernama.credibility, 80);
  assert.match(akp.summary, /as of March 13/u);
  assert.match(bernama.summary, /relayed AKP's report/u);
  assert.doesNotMatch(bernama.summary, /border checkpoints with Thailand/u);
});
