import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const survivorId = "ks7f96vtq164v13njvfcpz8j9n88we0s";
const mergedId = "ks726743rc7qxhny2hg2mt5ft588xsjr";
const starId = "k971mk77aenpj2y1kq61xw4m8n88x5pt";
const ktId = "jn7906bck1c1pph41v3ngh10vx88xkv0";
const expectedEvidenceIds = [
  "k97ce2vgjbpfh9tjqkbtqxgngd88tgjw",
  "k97ey7hc4jzq36c86qncan0rjh8c12jd",
  "k97af51s1grryvqksa4ykcxcgn8912ck",
  starId,
  ktId,
];

test("June 17 UNCLOS status update is merged into Thailand's June 16 appointment milestone", () => {
  const rows = readJsonl("data/timeline/2026-06.jsonl");
  const event = rows.find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(event.date, "2026-06-16");
  assert.equal(event.timeOfDay ?? "", "");
  assert.equal(rows.some((row) => row.id === mergedId), false);
  assert.deepEqual(event.evidenceIds, expectedEvidenceIds);
  assert.match(event.description, /Reporting on June 17/u);
  assert.match(event.description, /unofficial sources/u);
  assert.match(event.description, /one month to agree on a fifth member/u);
  assert.doesNotMatch(event.description, /formal response|June 19/u);
});

test("June 17-18 source summaries preserve Cambodia appointment uncertainty and chair-selection rule", () => {
  const news = readJsonl("data/news/2026-06.jsonl");
  const star = news.find((row) => row.id === starId);
  const kt = news.find((row) => row.id === ktId);
  assert.ok(star);
  assert.ok(kt);
  assert.match(star.summary, /had not yet been officially confirmed/u);
  assert.match(star.summary, /unofficial sources/u);
  assert.match(kt.summary, /after a June 16 Cabinet meeting/u);
  assert.match(kt.summary, /one month to agree on a fifth member/u);
});
