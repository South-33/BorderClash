import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7b73s62f38gfwfg3gmfa5had812e0a";
const evidenceId = "js73w25tk2t8j1jpv87x87tt657xq9pb";

test("Dec 21 Hill 350 row uses the supported 06:00 resumption time", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-21");
  assert.equal(event.timeOfDay, "06:00");
  assert.match(event.title, /Heavy Fighting Resumed Near Hill 350/u);
  assert.match(event.description, /midday on December 20/u);
  assert.match(event.description, /07:40/u);
  assert.match(event.description, /10:00/u);
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("battlefield claims remain attributed and unsupported location claims are removed", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /Thai reporting said/u);
  assert.match(event.description, /not independently verified/u);
  assert.doesNotMatch(event.description, /Military Zones 4 and 5/u);
  assert.doesNotMatch(event.description, /traveled to the sector/u);
  assert.doesNotMatch(event.title, /Counter-Attack/u);
});

test("Thai and Khmer preserve times, dates, counts, and attribution", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const value of ["20", "06:00", "21", "07:40", "10:00", "2", "350"]) {
    assert.ok(event.descriptionTh.includes(value), `Thai: ${value}`);
    assert.ok(event.descriptionKh.includes(value), `Khmer: ${value}`);
  }
  assert.match(event.descriptionTh, /ไม่ได้รับการยืนยันโดยอิสระ/u);
  assert.match(event.descriptionKh, /មិនត្រូវបានផ្ទៀងផ្ទាត់ដោយឯករាជ្យ/u);
});

test("evidence summary matches the captured chronology", () => {
  const article = readJsonl("data/news/2025-12.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.match(article.summary, /06:00/u);
  assert.match(article.summary, /07:40/u);
  assert.match(article.summary, /10:00/u);
  assert.match(article.summary, /midday on December 20/u);
});
