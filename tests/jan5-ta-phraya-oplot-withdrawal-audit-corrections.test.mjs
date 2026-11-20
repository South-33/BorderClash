import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks73h02wm4p1pj7wm64g57fefx813gse";
const evidenceId = "js76jaxefekzk7ty1tkbtjjtan7ynrb6";

test("Jan 5 Oplot redeployment is date-only and limited to what PPTV reported", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-01-05");
  assert.equal(event.timeOfDay ?? "", "");
  assert.match(event.title, /2nd Cavalry Battalion Withdraws Oplot Tanks from Ta Phraya/u);
  assert.match(event.description, /T-84 Oplot-M/u);
  assert.match(event.description, /Ban Ta Phraya/u);
  assert.match(event.description, /Thai troops remained deployed/u);
  assert.match(event.description, /does not establish an exact withdrawal time/u);
  assert.match(event.description, /does not establish.*first major heavy-armor withdrawal/u);
  assert.doesNotMatch(event.title, /Elite/u);
  assert.doesNotMatch(event.description, /light infantry/u);
});

test("English, Thai and Khmer preserve the same withdrawal scope", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const field of ["description", "descriptionTh", "descriptionKh"]) {
    assert.match(event[field], /T-84 Oplot-M/u);
  }
  assert.match(event.descriptionTh, /ยังคงมีกำลังทหารไทยประจำการ/u);
  assert.match(event.descriptionTh, /ไม่ได้ระบุเวลาเคลื่อนกำลังออกที่แน่นอน/u);
  assert.match(event.descriptionKh, /កងទ័ពថៃនៅតែដាក់ពង្រាយ/u);
  assert.match(event.descriptionKh, /មិនបញ្ជាក់ម៉ោងដកកម្លាំងជាក់លាក់/u);
});

test("PPTV evidence summary does not promote the redeployment into an unsupported milestone", () => {
  const article = readJsonl("data/news/2026-01.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.equal(article.provenanceId, "army-military-force-jan5-ta-phraya-oplot-withdrawal");
  assert.match(article.summary, /Army Military Force page published video/u);
  assert.match(article.summary, /Thai troops remained deployed/u);
  assert.match(article.summary, /did not describe this as the first major armor withdrawal/u);
});
