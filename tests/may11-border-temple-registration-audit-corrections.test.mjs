import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7e5eqcc81ekaw73gz3th3nt986zn37";
const fineArtsId = "89a06313326c19868235bc3a11f9aa0b";
const ppId = "jn78dvg01jefd9y6gb65baqpe586zn92";

test("border-temple registration uses the May 11 Royal Gazette date and no invented time", () => {
  const event = readJsonl("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-05-11");
  assert.equal(event.timeOfDay, "");
  assert.equal(event.category, "diplomatic");
  assert.deepEqual(event.evidenceIds, [fineArtsId, ppId]);
  assert.match(event.title, /Royal Gazette/u);
  assert.match(event.description, /79 archaeological sites/u);
  assert.match(event.description, /Prasat Ta Muen/u);
  assert.match(event.description, /Prasat Ta Kwai/u);
  assert.match(event.description, /Prasat Nong Khana/u);
  assert.match(event.description, /On May 13, Cambodia's Culture Ministry rejected/u);
  assert.match(event.description, /does not itself resolve the territorial dispute/u);
});

test("Thai and Khmer copy preserve both dates, site names and legal uncertainty", () => {
  const event = readJsonl("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.titleTh + event.descriptionTh, /[\u0E00-\u0E7F]/u);
  assert.match(event.titleKh + event.descriptionKh, /[\u1780-\u17FF]/u);
  for (const text of [event.descriptionTh, event.descriptionKh]) {
    assert.match(text, /11/u);
    assert.match(text, /13/u);
    assert.match(text, /79/u);
    assert.match(text, /Ta Muen|ตาเมือน/u);
    assert.match(text, /Ta Kwai|ตาควาย/u);
    assert.match(text, /Nong Khana|หนองคะนา/u);
    assert.doesNotMatch(text, /�|\?{3,}/u);
  }
});

test("Thai Fine Arts source anchors the domestic heritage listing without deciding sovereignty", () => {
  const source = readJsonl("data/news/2026-05.jsonl").find((row) => row.id === fineArtsId);
  assert.ok(source);
  assert.equal(source.source, "Thailand Fine Arts Department");
  assert.equal(source.credibility, 100);
  assert.equal(source.category, "political");
  assert.equal(source.provenanceId, "thai-fine-arts-border-temple-listing-2026-05-11");
  assert.match(source.summary, /Royal Gazette on May 11, 2026/u);
  assert.match(source.summary, /79 archaeological sites/u);
  assert.match(source.summary, /Nong Khana.*Ta Muen.*Ta Kwai/u);
  assert.match(source.summary, /does not itself resolve the international boundary or sovereignty dispute/u);
});

test("Cambodian May 13 reaction stays attributed as a legal position", () => {
  const source = readJsonl("data/news/2026-05.jsonl").find((row) => row.id === ppId);
  assert.ok(source);
  assert.equal(source.category, "diplomatic");
  assert.match(source.summary, /On May 13, Cambodia's Culture Ministry rejected/u);
  assert.match(source.summary, /illegal, null and without legal effect/u);
  assert.match(source.summary, /could not establish sovereignty or delimit the international border/u);
  assert.match(source.summary, /Cambodia's protest and legal position/u);
  assert.match(source.summary, /not the underlying sovereignty claim/u);
});
