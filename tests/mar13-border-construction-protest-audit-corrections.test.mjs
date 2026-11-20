import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7db7c2ky8y52hf5w2e7jrxtx82vz9c";
const provenanceId = "cambodia-mfa-mar13-border-construction-protest";

test("Mar 13 protest is date-only and keeps disputed construction claims attributed", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-03-13");
  assert.equal(Object.hasOwn(event, "timeOfDay"), false);
  assert.match(event.title, /Cambodia Protests/u);
  assert.match(event.title, /Attributes to Thai Forces/u);
  assert.match(event.description, /Cambodia said/u);
  assert.match(event.description, /February 23 to 25/u);
  assert.match(event.description, /March 7/u);
  assert.match(event.description, /1962 and 2013 ICJ judgments/u);
  assert.match(event.description, /Article 5 of the 2000 land-boundary MOU/u);
  assert.match(event.description, /does not independently establish responsibility/u);
  assert.deepEqual(event.evidenceIds, [
    "jn78396ew9pw01w4wqstn177ch830gad",
    "jn7fmk6w0swjn2jc58ed7gdtqs82tmtp",
  ]);
});

test("Thai and Khmer preserve dates, attribution, and uncertainty", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const text of [event.descriptionTh, event.descriptionKh]) {
    for (const token of ["13", "23", "25", "7", "1962", "2013", "2000", "27", "2025"]) {
      assert.match(text, new RegExp(token, "u"));
    }
  }
  assert.match(event.descriptionTh, /กัมพูชาระบุ/u);
  assert.match(event.descriptionTh, /ไม่ได้ยืนยันโดยอิสระ/u);
  assert.match(event.descriptionKh, /កម្ពុជាបាននិយាយ/u);
  assert.match(event.descriptionKh, /មិនបានបញ្ជាក់ដោយឯករាជ្យ/u);
});

test("reports derived from the March 13 Cambodian protest share provenance", () => {
  const news = readJsonl("data/news/2026-03.jsonl");
  const ids = [
    "jn73r7nkng71t0d9hz0n0kbjmx833y20",
    "jn7fmk6w0swjn2jc58ed7gdtqs82tmtp",
    "jn7f140xaf8nwpyx3xy61jypt982w9hx",
    "jn78396ew9pw01w4wqstn177ch830gad",
  ];
  for (const id of ids) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, provenanceId);
  }
});
