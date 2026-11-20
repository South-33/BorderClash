import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const retainedId = "ks7bxt0jv35sxsfppy552txnth81nc11";
const mergedId = "ks773zprd8pydm8ssamp0w21bn81qsnc";
const directReutersId = "9be161031232031811ec7ca4544c08de";
const ministryId = "27b7f326d1a88742a6d29bc3f7cc02a2";
const thaiRebuttalId = "k97f4e9efgrevr34w6jzn0bqdx81ev68";
const reutersProvenance = "reuters-hun-manet-interview-2026-02-17";

test("February 20 retelling is merged into the existing February 17 interview milestone", () => {
  const timeline = readJsonl("data/timeline/2026-02.jsonl");
  const retained = timeline.find((row) => row.id === retainedId);
  assert.ok(retained);
  assert.equal(timeline.some((row) => row.id === mergedId), false);
  assert.equal(retained.date, "2026-02-17");
  assert.equal(retained.timeOfDay ?? "", "");
  assert.deepEqual(retained.evidenceIds, [directReutersId, ministryId, thaiRebuttalId]);
});

test("retained milestone attributes the occupation claim and does not make barriers the sole cause", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === retainedId);
  assert.ok(event);
  assert.match(event.description, /Hun Manet told Reuters/u);
  assert.match(event.description, /about 80,000 people remained in camps/u);
  assert.match(event.description, /other obstacles to return including heavily damaged homes and unexploded ordnance/u);
  assert.match(event.description, /Thailand denied occupying Cambodian territory/u);
  assert.doesNotMatch(event.description, /80,000.*due to new Thai military fortifications/u);
});

test("Thai and Khmer copy preserve attribution, multiple causes, and Thailand's denial", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === retainedId);
  assert.ok(event);
  assert.match(event.descriptionTh, /ฮุน มาเนต บอก Reuters/u);
  assert.match(event.descriptionTh, /บ้านเรือนเสียหายหนักและวัตถุระเบิดที่ยังไม่ระเบิด/u);
  assert.match(event.descriptionTh, /ไทยปฏิเสธ/u);
  assert.match(event.descriptionKh, /ហ៊ុន ម៉ាណែត បានប្រាប់ Reuters/u);
  assert.match(event.descriptionKh, /ផ្ទះខូចខាតធ្ងន់ធ្ងរ និងសំណល់ជាតិផ្ទុះមិនទាន់ផ្ទុះ/u);
  assert.match(event.descriptionKh, /ថៃបានបដិសេធ/u);
});

test("Reuters copies share provenance and the later Khmer Times article is explicitly attributed", () => {
  const articles = readJsonl("data/news/2026-02.jsonl");
  const direct = articles.find((row) => row.id === directReutersId);
  const wkzo = articles.find((row) => row.id === "k97ejwbe3xs00pnwk8hdcw2pm981nesa");
  const ctv = articles.find((row) => row.id === "k97805stgk538kcmw2pbkt5dcx81hhar");
  const khmerTimes = articles.find((row) => row.id === "jn7463fegbvctqx9s6n2hd3srn81psm7");
  const ministry = articles.find((row) => row.id === ministryId);
  assert.ok(direct);
  assert.ok(wkzo);
  assert.ok(ctv);
  assert.ok(khmerTimes);
  assert.ok(ministry);
  for (const article of [direct, wkzo, ctv]) assert.equal(article.provenanceId, reutersProvenance);
  assert.equal(khmerTimes.credibility, 60);
  assert.match(khmerTimes.summary, /Hun Manet's allegation/u);
  assert.match(khmerTimes.summary, /not independent proof/u);
  assert.match(ministry.summary, /multiple causes/u);
});
