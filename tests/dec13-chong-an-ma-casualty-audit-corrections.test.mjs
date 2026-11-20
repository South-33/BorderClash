import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7a4h7p0nwezh46tdd7j4hwsx8138na";
const infoQuestId = "jne5358fa286aa689d9f7d3ee105dd74";
const naewnaId = "js77gc47gq0edfayyazszy1phh7x91g8";
const vibesId = "k97eyxb06avvp33yqtwajtzbms7x861f";
const provenanceId = "thai-joint-border-briefing-2025-12-13";

test("Dec 13 Chong An Ma casualty row is date-only and bounded to the Thai briefing", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-13");
  assert.equal(event.timeOfDay, "");
  assert.match(event.title, /^Thai Defence Ministry Reports Four More Soldiers Killed/u);
  assert.match(event.description, /four more Thai soldiers had been killed in clashes at Chong An Ma/u);
  assert.match(event.description, /deaths from clashes to 14/u);
  assert.match(event.description, /15 military deaths in total/u);
  assert.match(event.description, /seven civilian deaths as indirect effects/u);
  assert.match(event.description, /four during evacuation and three in shelters/u);
  assert.deepEqual(event.evidenceIds, [infoQuestId]);
  assert.doesNotMatch(event.description, /underlying disease|accident|rocket strike/u);
});

test("Dec 13 Chong An Ma localizations preserve the same casualty breakdown", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.titleTh + event.descriptionTh, /[\u0E00-\u0E7F]/u);
  assert.match(event.titleKh + event.descriptionKh, /[\u1780-\u17FF]/u);
  for (const text of [event.descriptionTh, event.descriptionKh]) {
    assert.match(text, /4/u);
    assert.match(text, /14/u);
    assert.match(text, /15/u);
    assert.match(text, /7/u);
    assert.match(text, /3/u);
    assert.doesNotMatch(text, /\?|�/u);
  }
  assert.match(event.descriptionTh, /4 รายเสียชีวิตระหว่างอพยพ/u);
  assert.match(event.descriptionTh, /3 รายเสียชีวิตในศูนย์พักพิง/u);
  assert.match(event.descriptionKh, /4 នាក់ស្លាប់ពេលជម្លៀស/u);
  assert.match(event.descriptionKh, /3 នាក់ស្លាប់នៅមណ្ឌលជម្រក/u);
});

test("reports carrying the Dec 13 Thai joint briefing share provenance", () => {
  const news = readJsonl("data/news/2025-12.jsonl");
  const infoQuest = news.find((row) => row.id === infoQuestId);
  const naewna = news.find((row) => row.id === naewnaId);
  const vibes = news.find((row) => row.id === vibesId);
  assert.ok(infoQuest);
  assert.ok(naewna);
  assert.ok(vibes);
  assert.equal(infoQuest.provenanceId, provenanceId);
  assert.equal(naewna.provenanceId, provenanceId);
  assert.equal(vibes.provenanceId, provenanceId);
  assert.match(infoQuest.summary, /four during evacuation and three in shelters/u);
});
