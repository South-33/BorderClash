import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const survivorId = "ks728jadnxyvb0ysesxz78drqd812f7j";
const mergedId = "ks7c7epg90jh284q4zzkmq7r098131ay";
const reutersId = "k978tkwkq42dp7fq696gk29d8x811t0k";
const blockedApId = "k9796nkmke1njwv18a4w95stex813j59";
const gulfApId = "366e94b62fb54cb6daa2528865a79a53";

test("Feb 11 scam crackdown and worker exodus are one date-only timeline milestone", () => {
  const timeline = readJsonl("data/timeline/2026-02.jsonl");
  const event = timeline.find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(event.date, "2026-02-11");
  assert.equal(event.timeOfDay ?? "", "");
  assert.equal(timeline.some((row) => row.id === mergedId), false);
  assert.equal(event.importance, 68);
  assert.match(event.title, /Scam-Centre Crackdown as Thousands Leave Compounds/u);
  assert.deepEqual(event.evidenceIds, [reutersId, gulfApId]);
});

test("survivor keeps enforcement totals and the humanitarian consequence without inventing a military cause", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  assert.match(event.description, /about 190 scam-centre locations/u);
  assert.match(event.description, /173 senior figures/u);
  assert.match(event.description, /about 11,000 workers/u);
  assert.match(event.description, /thousands of scam workers/u);
  assert.match(event.description, /escapee from O'Smach/u);
  assert.match(event.description, /crackdown and mass releases/u);
  assert.match(event.description, /not to sustained Thai military pressure/u);
  assert.match(event.description, /Thai forces had bombed and occupied an O'Smach compound/u);
});

test("English, Thai and Khmer preserve the same numbers and causal distinction", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  for (const field of ["description", "descriptionTh", "descriptionKh"]) {
    assert.match(event[field], /190/u);
    assert.match(event[field], /173/u);
    assert.match(event[field], /11,000/u);
  }
  assert.match(event.descriptionTh, /ไม่ใช่กับแรงกดดันทางทหารของไทยอย่างต่อเนื่อง/u);
  assert.match(event.descriptionKh, /មិនមែនទៅនឹងសម្ពាធយោធាថៃជាបន្តបន្ទាប់/u);
});

test("AP copies share provenance and the blocked copy no longer carries the false border-cause summary", () => {
  const articles = readJsonl("data/news/2026-02.jsonl");
  const blockedAp = articles.find((row) => row.id === blockedApId);
  const gulfAp = articles.find((row) => row.id === gulfApId);
  const reuters = articles.find((row) => row.id === reutersId);
  assert.ok(blockedAp);
  assert.ok(gulfAp);
  assert.ok(reuters);
  assert.equal(blockedAp.status, "archived");
  assert.equal(blockedAp.provenanceId, "associated-press-feb11-cambodia-scam-compound-exodus");
  assert.equal(gulfAp.provenanceId, "associated-press-feb11-cambodia-scam-compound-exodus");
  assert.match(blockedAp.summary, /government crackdown and mass releases/u);
  assert.match(blockedAp.summary, /did not attribute the broader exodus to sustained Thai military pressure/u);
  assert.match(gulfAp.summary, /escapee from O'Smach/u);
  assert.match(reuters.summary, /about 190 scam-centre locations/u);
});
