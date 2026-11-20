import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks76wk6d4eb8be65pdvq1ghdj584hr09";
const toVimaId = "k97cff3da9zg98cghwmtq4svz584h827";
const thaiPbsId = "js7djqpyhe48c0e0h2mvwgnt1184fqbf";
const apIds = [
  "k9705w3f98sgjt8vmx61w7nwbx84gdb5",
  "jn7a3xnyydq3v408kv8xgq07ph84gs1f",
  "js7dx30yynm9x303sw34jye77s84jawm",
];
const apProvenance = "ap-osmach-media-tour-2026-04-07";

test("Apr 7 O'Smach row is bounded to the media tour and usable captured evidence", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-04-07");
  assert.equal(event.timeOfDay ?? "", "");
  assert.equal(event.title, "Thai Military Leads Journalists Through O'Smach Resort Complex");
  assert.match(event.description, /approximately 80-hectare site with 157 buildings/u);
  assert.match(event.description, /29 used for scam businesses/u);
  assert.match(event.description, /Thai PBS World separately reported Thai officials' claims/u);
  assert.doesNotMatch(event.description, /Cambodia has protested|157-160/u);
  assert.deepEqual(event.evidenceIds, [toVimaId, thaiPbsId]);
});

test("Apr 7 O'Smach localizations preserve attribution and core numbers", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.titleTh + event.descriptionTh, /[\u0E00-\u0E7F]/u);
  assert.match(event.titleKh + event.descriptionKh, /[\u1780-\u17FF]/u);
  for (const text of [event.descriptionTh, event.descriptionKh]) {
    assert.match(text, /80/u);
    assert.match(text, /157/u);
    assert.match(text, /29/u);
    assert.match(text, /Thai PBS World/u);
    assert.doesNotMatch(text, /\?|�/u);
  }
});

test("AP-derived reports share provenance and preserve their media environments", () => {
  const news = readJsonl("data/news/2026-04.jsonl");
  const rows = apIds.map((id) => news.find((row) => row.id === id));
  const toVima = news.find((row) => row.id === toVimaId);
  assert.ok(rows.every(Boolean));
  assert.ok(toVima);
  for (const row of rows) {
    assert.equal(row.provenanceId, apProvenance);
    assert.equal(row.credibility, 90);
  }
  assert.equal(toVima.provenanceId, apProvenance);
  assert.equal(rows[0].source, "Associated Press");
  assert.equal(rows[1].source, "Associated Press via Kiripost");
  assert.equal(rows[1].mediaEnvironment, "cambodia-domestic");
  assert.equal(rows[2].source, "Associated Press via OPB");
  assert.equal(rows[2].mediaEnvironment, "international");
});

test("To Vima record is not mislabeled as Reuters and Thai PBS claims stay attributed", () => {
  const news = readJsonl("data/news/2026-04.jsonl");
  const toVima = news.find((row) => row.id === toVimaId);
  const thaiPbs = news.find((row) => row.id === thaiPbsId);
  assert.ok(toVima);
  assert.ok(thaiPbs);
  assert.equal(toVima.source, "To Vima");
  assert.match(toVima.summary, /To Vima described/u);
  assert.match(thaiPbs.summary, /Thai officials described/u);
  assert.match(thaiPbs.summary, /Defence sources also claimed/u);
});
