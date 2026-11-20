import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks72pz74mv38q9tajbqhanxqf5813qe7";
const akpId = "bba72a226ea03a35d8dada095e0de744";
const oldOknhaId = "jn74xch62qkjcerr5bf5h6jysn7y3mw9";

test("Hun Manet Thai-nationals appeal is dated July 24 and has no unsupported exact time", () => {
  const july = readJsonl("data/timeline/2025-07.jsonl");
  const december = readJsonl("data/timeline/2025-12.jsonl");
  const event = july.find((row) => row.id === eventId);

  assert.ok(event);
  assert.equal(event.date, "2025-07-24");
  assert.equal(event.timeOfDay ?? "", "");
  assert.deepEqual(event.evidenceIds, [akpId]);
  assert.equal(december.some((row) => row.id === eventId), false);
});

test("canonical copy stays within the captured July 24 appeal", () => {
  const event = readJsonl("data/timeline/2025-07.jsonl").find((row) => row.id === eventId);
  assert.ok(event);

  assert.match(event.description, /Royal Thai Embassy/u);
  assert.match(event.description, /Thai companies/u);
  assert.match(event.description, /Thai citizens living in Cambodia/u);
  assert.match(event.description, /Cambodians in Thailand/u);
  assert.doesNotMatch(event.description, /fragile diplomatic opening|retaliatory riots|14:00/iu);

  assert.match(event.titleKh, /កុំរើសអើង/u);
  assert.match(event.descriptionKh, /ស្ថានទូតថៃ/u);
  assert.match(event.titleTh, /ไม่เลือกปฏิบัติ/u);
  assert.match(event.descriptionTh, /สถานเอกอัครราชทูตไทย/u);
});

test("captured AKP evidence supports the July appeal and the old Oknha summary matches its ceasefire page", () => {
  const julyNews = readJsonl("data/news/2025-07.jsonl");
  const decemberNews = readJsonl("data/news/2025-12.jsonl");
  const akp = julyNews.find((row) => row.id === akpId);
  const oknha = decemberNews.find((row) => row.id === oldOknhaId);

  assert.ok(akp);
  assert.equal(akp.sourceUrl, "https://www.akp.gov.kh/post/detail/343199");
  assert.equal(akp.provenanceId, "hun-manet-thai-nationals-restraint-2025-07-24");
  assert.match(akp.summary, /July 24/u);
  assert.match(akp.summary, /Royal Thai Embassy/u);

  assert.ok(oknha);
  assert.match(oknha.summary, /ceasefire effective at 12:00 noon on December 27, 2025/u);
  assert.match(oknha.summary, /Joint Boundary Commission/u);
  assert.doesNotMatch(oknha.summary, /Hun Manet|Thai embassy|Thai citizens/iu);
});
