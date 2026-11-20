import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7dw91m4km43v8tmdzy559jvx89r31g";
const akpId = "f8a3ba9bc5b36e1c9ab1ff799e5ab223";
const annId = "k97e4eqrvw9agdr1w8v7zgw47s89sn83";
const provenanceId = "cambodia-water-festival-circular-2026-06-25";

test("Water Festival decision is dated to the June 25 circular and moved out of July", () => {
  const june = readJsonl("data/timeline/2026-06.jsonl");
  const july = readJsonl("data/timeline/2026-07.jsonl");
  const event = june.find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-06-25");
  assert.equal(event.timeOfDay, "");
  assert.equal(july.some((row) => row.id === eventId), false);
  assert.deepEqual(event.evidenceIds, [akpId, annId]);
});

test("timeline copy limits the suspension to Phnom Penh celebrations and preserves local options", () => {
  const event = readJsonl("data/timeline/2026-06.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.title, /Phnom Penh Water Festival Celebrations/u);
  assert.match(event.description, /Provincial celebrations may still proceed/u);
  assert.match(event.description, /three-day public holiday remains in effect/u);
  assert.match(event.description, /returning Cambodian migrant workers/u);
  assert.doesNotMatch(event.description, /21,425/u);
  assert.match(event.descriptionTh, /จังหวัดต่าง ๆ ยังสามารถจัดงาน/u);
  assert.match(event.descriptionTh, /วันหยุดราชการ 3 วันยังคงเดิม/u);
  assert.match(event.descriptionKh, /ខេត្តនានាអាចបន្តរៀបចំពិធី/u);
  assert.match(event.descriptionKh, /ថ្ងៃឈប់សម្រាក 3 ថ្ងៃនៅតែរក្សាដដែល/u);
  assert.doesNotMatch(event.descriptionTh, /�/u);
  assert.doesNotMatch(event.descriptionKh, /�/u);
});

test("article evidence separates the June 25 circular from the June 30 displacement statistic", () => {
  const juneArticles = readJsonl("data/news/2026-06.jsonl");
  const julyArticles = readJsonl("data/news/2026-07.jsonl");
  const akp = juneArticles.find((row) => row.id === akpId);
  const ann = julyArticles.find((row) => row.id === annId);
  assert.ok(akp);
  assert.ok(ann);
  assert.equal(akp.source, "AKP");
  assert.equal(akp.status, "archived");
  assert.equal(akp.credibility, 90);
  assert.equal(akp.provenanceId, provenanceId);
  assert.equal(ann.provenanceId, provenanceId);
  assert.match(akp.summary, /a Cambodian government circular/u);
  assert.match(ann.summary, /Separately, Cambodia's Interior Ministry said that as of June 30, 21,425/u);
});
