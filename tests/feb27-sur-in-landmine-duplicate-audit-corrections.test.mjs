import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const survivorId = "ks75fpwwzx7pe0mj8wgcaez1t98253zt";
const duplicateId = "ks73jfnm58x6bg53sjr8jcbann8240mc";
const evidenceId = "a43d22051c6eea42fe14ddd393a011a5";
const deadThaiPbsId = "js72mpk743gwz1ffsj1jjbg151824n7v";

test("older stable ID survives and is corrected to the captured Feb 27 06:44 incident", () => {
  const timeline = read("data/timeline/2026-02.jsonl");
  const event = timeline.find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(event.date, "2026-02-27");
  assert.equal(event.timeOfDay, "06:44");
  assert.equal(event.status, "confirmed");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
  assert.equal(timeline.some((row) => row.id === duplicateId), false);
});

test("surviving milestone does not retain unsupported Feb 26, 10:00 or airlift details", () => {
  const event = read("data/timeline/2026-02.jsonl").find((row) => row.id === survivorId);
  assert.doesNotMatch(event.description, /February 26|10:00|airlift|helicopter/u);
  assert.match(event.description, /06:44/u);
  assert.match(event.description, /loss of his right leg/u);
  assert.match(event.description, /not newly laid/u);
});

test("mine age and area-control language stays attributed to the Thai military", () => {
  const event = read("data/timeline/2026-02.jsonl").find((row) => row.id === survivorId);
  assert.match(event.description, /Thai military positions/u);
  assert.match(event.description, /not independently established/u);
  assert.match(event.descriptionTh, /จุดยืนของฝ่ายทหารไทย/u);
  assert.match(event.descriptionKh, /ជំហររបស់យោធាថៃ/u);
});

test("dead Thai PBS capture is downgraded and unused replacement rows are not retained", () => {
  const news = read("data/news/2026-02.jsonl");
  const deadThaiPbs = news.find((row) => row.id === deadThaiPbsId);
  const naewna = news.find((row) => row.id === evidenceId);
  assert.ok(deadThaiPbs && naewna);
  assert.equal(deadThaiPbs.status, "unverified");
  assert.equal(deadThaiPbs.credibility, 40);
  assert.match(deadThaiPbs.summary, /Article not found/u);
  assert.equal(naewna.credibility, 70);
  assert.match(naewna.summary, /06:44/u);
  assert.equal(news.some((row) => row.id === "13bbab8fee9d4ccec24f857bae4ec41a"), false);
  assert.equal(news.some((row) => row.id === "6b4fa8305d74af0c48b9e3b6b45ec72f"), false);
});
