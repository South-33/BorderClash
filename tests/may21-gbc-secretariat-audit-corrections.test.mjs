import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks72crrvmxy5gcs3vy43ppn065875w1p";
const evidenceId = "js7c3ged6dmfvqfam6hvk2m1h1875s5m";

test("May 21 GBC milestone is date-only and describes secretariat coordination", () => {
  const event = readJsonl("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-05-21");
  assert.equal(event.timeOfDay ?? "", "");
  assert.match(event.title, /GBC Secretariats Will Hold Preliminary Talks/u);
  assert.match(event.description, /secretariats would talk first before a full GBC meeting/u);
  assert.doesNotMatch(event.description, /12:00/u);
});

test("the timeline explicitly rejects the unsupported frontier-dispatch framing", () => {
  const event = readJsonl("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /does not say a GBC sub-committee was dispatched to the frontier/u);
  assert.match(event.descriptionTh, /ไม่ได้ระบุว่ามีการส่งคณะอนุกรรมการ GBC ลงพื้นที่ชายแดน/u);
  assert.match(event.descriptionKh, /មិនបាននិយាយថា មានការបញ្ជូនអនុគណៈកម្មការ GBC ទៅតំបន់ព្រំដែនទេ/u);
});

test("evidence summary matches the captured Siam Rath body rather than its headline shorthand", () => {
  const article = readJsonl("data/news/2026-05.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.match(article.summary, /GBC secretariats would first discuss arrangements/u);
  assert.match(article.summary, /does not report a GBC sub-committee being dispatched to the frontier/u);
});
