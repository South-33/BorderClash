import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks77egn71y96vpw7211gv0wj5h82dmrn";
const evidenceId = "jn78g8swqcv0fh4edjzzzrakp982d6mq";

test("Preah Vihear attaché inspection uses the source-supported 10:35 time", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-03-05");
  assert.equal(event.timeOfDay, "10:35");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.match(event.description, /At 10:35 on March 5/u);
});

test("record says 12 delegations rather than inventing an exact attaché headcount", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /12 foreign delegations/u);
  assert.doesNotMatch(event.description, /12 foreign military attachés/u);
});

test("Cambodian attribution is explicit in all three languages", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /according to the Cambodian presentation/u);
  assert.match(event.description, /not independent proof/u);
  assert.match(event.descriptionTh, /ตามข้อมูลที่ฝ่ายกัมพูชานำเสนอ/u);
  assert.match(event.descriptionTh, /ไม่ได้ยืนยันโดยอิสระ/u);
  assert.match(event.descriptionKh, /តាមការបង្ហាញរបស់ភាគីកម្ពុជា/u);
  assert.match(event.descriptionKh, /មិនមែនជាភស្តុតាងឯករាជ្យ/u);
});

test("stored AKP summary preserves the exact time, delegation count and attribution boundary", () => {
  const article = readJsonl("data/news/2026-03.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.equal(article.credibility, 40);
  assert.match(article.summary, /10:35 on March 5/u);
  assert.match(article.summary, /12 foreign delegations/u);
  assert.match(article.summary, /attributed their use to the Thai military/u);
  assert.match(article.summary, /not independent proof/u);
});
