import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7cfse9yfj707j3ndzb0f9djh87ka95";
const evidenceId = "0f80f587f47863b67d5c488ce7a9198c";

test("Anutin map and UNESCO remarks are dated to May 27 at the supported time", () => {
  const event = readJsonl("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-05-27");
  assert.equal(event.timeOfDay, "16:25");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("UNESCO wording does not invent a formal Thai inspection request", () => {
  const event = readJsonl("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /had not formally requested an inspection/u);
  assert.match(event.description, /inspect and hear information from both Thailand and Cambodia/u);
  assert.doesNotMatch(event.description, /formally requested UNESCO/u);
});

test("map language remains Thailand's position rather than a boundary finding", () => {
  const event = readJsonl("data/timeline/2026-05.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /Thailand relies on 1:50,000-scale maps/u);
  assert.match(event.description, /do not establish the legal boundary/u);
  assert.match(event.descriptionTh, /ไม่ใช่ข้อยุติทางกฎหมายเกี่ยวกับแนวเขตแดน/u);
  assert.match(event.descriptionKh, /មិនមែនជាការកំណត់ខ្សែព្រំដែនតាមផ្លូវច្បាប់ទេ/u);
});

test("captured Naewna evidence records the May 27 interview and no formal request", () => {
  const article = readJsonl("data/news/2026-05.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.equal(article.source, "Naewna");
  assert.match(article.summary, /16:25 on May 27/u);
  assert.match(article.summary, /had not formally requested an inspection/u);
});
