import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const survivorId = "ks7dx45n80rm9k168n6z1qr2qx82gm4h";
const duplicateId = "ks76xce0pyfh2ymqeq15mmg12n827bt8";
const cppId = "jn7f67k7wcn2ggm28z3t8ccvqs82g23x";
const pressId = "7b169d0702d2af67093b58a268af9e1e";
const provenanceId = "cambodia-government-mar2-un-coordinator-meeting";

test("March 3 duplicates are merged into the source-supported March 2 meeting", () => {
  const timeline = readJsonl("data/timeline/2026-03.jsonl");
  const event = timeline.find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(timeline.some((row) => row.id === duplicateId), false);
  assert.equal(event.date, "2026-03-02");
  assert.equal(event.timeOfDay ?? "", "");
  assert.match(event.title, /UN Coordinator and Hun Manet Discuss Cambodia-Thailand Border Dispute/u);
  assert.deepEqual(event.evidenceIds, [pressId, cppId]);
});

test("event states only the border briefing and UN position supported by the sources", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  assert.match(event.description, /briefed her on recent Cambodia-Thailand border developments/u);
  assert.match(event.description, /UN Charter and international law/u);
  assert.match(event.description, /socio-economic development/u);
  assert.doesNotMatch(event.description, /Thai territorial incursions/u);
  assert.doesNotMatch(event.description, /displacement/u);
  assert.doesNotMatch(event.description, /10:00/u);
});

test("English Thai and Khmer preserve March 2, both actors and the peaceful-resolution position", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  for (const field of ["description", "descriptionTh", "descriptionKh"]) {
    assert.match(event[field], /2/u);
    assert.match(event[field], /Andreeva/u);
  }
  assert.match(event.description, /Hun Manet/u);
  assert.match(event.descriptionTh, /Hun Manet/u);
  assert.match(event.descriptionKh, /ហ៊ុន ម៉ាណែត/u);
  assert.match(event.descriptionTh, /กฎบัตรสหประชาชาติ/u);
  assert.match(event.descriptionKh, /ធម្មនុញ្ញអង្គការសហប្រជាជាតិ/u);
});

test("direct government and CPP copies share provenance and record March 2", () => {
  const articles = readJsonl("data/news/2026-03.jsonl");
  const press = articles.find((row) => row.id === pressId);
  const cpp = articles.find((row) => row.id === cppId);
  assert.ok(press);
  assert.ok(cpp);
  assert.equal(press.provenanceId, provenanceId);
  assert.equal(cpp.provenanceId, provenanceId);
  assert.match(press.summary, /morning of March 2/u);
  assert.match(cpp.summary, /Monday morning, March 2/u);
});
