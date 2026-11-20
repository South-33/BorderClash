import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path) { return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse); }
const militaryId = "ks7ea6bcweq013vg1vt7t6t7q984e67g";
const protestId = "ks773t3pk4bv9m83ae3wf7bqm984ztfn";
const oldHumanitarianId = "ks77kk588zsqaqnt8y2ah67q4s84aq99";
const apr3HumanitarianId = "ks7f1z2f366e1tvz2xp98vmyfd844hmf";
const protestProvenance = "cambodia-mfa-preah-vihear-protest-2026-04-05";

test("Apr 4 military allegation and Apr 5 diplomatic protest remain distinct", () => {
  const timeline = readJsonl("data/timeline/2026-04.jsonl");
  const military = timeline.find((row) => row.id === militaryId);
  const protest = timeline.find((row) => row.id === protestId);
  assert.ok(military); assert.ok(protest);
  assert.equal(military.date, "2026-04-04");
  assert.equal(military.timeOfDay, "");
  assert.match(military.description, /about 100 metres of barbed wire/u);
  assert.match(military.description, /Cambodian government allegations/u);
  assert.match(military.description, /do not independently establish the boundary status/u);
  assert.equal(protest.date, "2026-04-05");
  assert.equal(protest.category, "diplomatic");
  assert.match(protest.title, /Formally Protests/u);
});

test("April displacement totals stay on the original Apr 3 snapshot, not a publication-date duplicate", () => {
  const timeline = readJsonl("data/timeline/2026-04.jsonl");
  assert.equal(timeline.find((row) => row.id === oldHumanitarianId), undefined);
  const row = timeline.find((item) => item.id === apr3HumanitarianId);
  assert.ok(row);
  assert.equal(row.date, "2026-04-03");
  assert.equal(row.category, "humanitarian");
  assert.match(row.description, /610,000/u);
  assert.match(row.description, /34,937/u);
});

test("Preah Vihear source chain and composite summary preserve chronology", () => {
  const news = readJsonl("data/news/2026-04.jsonl");
  const khmerTimes = news.find((row) => row.id === "k97ddr6xg80kqhymc4zcngw7wx84y386");
  const freshNews = news.find((row) => row.id === "jn7a55qwwhe071karvw8h84gj184fsvm");
  const composite = news.find((row) => row.id === "jn7cc2m2ps1dn09rkf62p2e60h84begm");
  assert.equal(khmerTimes?.provenanceId, protestProvenance);
  assert.equal(freshNews?.provenanceId, protestProvenance);
  assert.match(composite?.summary || "", /combined three earlier Cambodian government updates/u);
  assert.match(composite?.summary || "", /610,000/u);
});