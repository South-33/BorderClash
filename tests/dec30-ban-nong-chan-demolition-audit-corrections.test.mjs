import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks73787hbqs2q9sbvkskyfgrcx812a3p";
const thaiNewsroomId = "90cb28b6b6952efda2fbfae3b61aca6e";
const afpId = "k975kpbg4traphyjq119yfvj8x7yhv5y";
const bangkokPostId = "js7emyrkqxfn56rxpjdyszfn417yg239";

test("Ban Nong Chan demolition milestone uses the first specifically dated post-ceasefire demolition", () => {
  const december = readJsonl("data/timeline/2025-12.jsonl");
  const january = readJsonl("data/timeline/2026-01.jsonl");
  const event = december.find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-30");
  assert.equal(event.timeOfDay, "");
  assert.equal(january.some((row) => row.id === eventId), false);
  assert.deepEqual(event.evidenceIds, [thaiNewsroomId, afpId]);
  assert.match(event.title, /Thai Report Dates Ban Nong Chan Demolition to Dec\. 30/u);
  assert.match(event.description, /reported that on December 30/u);
  assert.match(event.description, /Thai sources described/u);
  assert.match(event.description, /Cambodian Information Minister Neth Pheaktra told AFP/u);
  assert.match(event.description, /Thai Army rejected Cambodia's annexation claim/u);
  assert.match(event.description, /boundary status remains disputed/u);
});

test("Ban Nong Chan localizations preserve chronology, attribution and disputed status", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.titleTh + event.descriptionTh, /[\u0E00-\u0E7F]/u);
  assert.match(event.titleKh + event.descriptionKh, /[\u1780-\u17FF]/u);
  for (const text of [event.descriptionTh, event.descriptionKh]) {
    assert.match(text, /30/u);
    assert.match(text, /2/u);
    assert.match(text, /AFP/u);
    assert.doesNotMatch(text, /�|\?{3,}/u);
  }
});

test("Thai Newsroom source dates the demolition and keeps Thai territorial claims attributed", () => {
  const news = readJsonl("data/news/2026-01.jsonl");
  const source = news.find((row) => row.id === thaiNewsroomId);
  assert.ok(source);
  assert.equal(source.source, "Thai Newsroom / PPTVHD36");
  assert.equal(source.credibility, 70);
  assert.equal(source.provenanceId, "pptv-ban-nong-chan-clearance-2026-01-03");
  assert.match(source.summary, /December 30, 2025/u);
  assert.match(source.summary, /Thai side described as encroaching/u);
  assert.match(source.summary, /Thailand's claims/u);
});

test("Bangkok Post summary no longer presents sovereignty as established fact", () => {
  const source = readJsonl("data/news/2026-01.jsonl").find((row) => row.id === bangkokPostId);
  assert.ok(source);
  assert.match(source.summary, /Thai military described/u);
  assert.match(source.summary, /Cambodia rejected/u);
  assert.match(source.summary, /does not independently establish sovereignty/u);
});

test("AFP summary attributes the rebuttal to the Thai Army, not the prime minister", () => {
  const source = readJsonl("data/news/2026-01.jsonl").find((row) => row.id === afpId);
  assert.ok(source);
  assert.match(source.summary, /Thai Army rejected/u);
  assert.match(source.summary, /disputed Chouk Chey border village/u);
  assert.doesNotMatch(source.summary, /Prime Minister Anutin|visiting troops in Surin/u);
});

test("Jan 2 and Jan 3 political-diplomatic milestones remain separate", () => {
  const january = readJsonl("data/timeline/2026-01.jsonl");
  const jan2 = january.find((row) => row.id === "ks70a9cec21h78j3nq3qhj5amx813sfc");
  const jan3 = january.find((row) => row.id === "ks796hvd3wjaj6m4h5sea7ks0x81376b");
  assert.ok(jan2);
  assert.ok(jan3);
  assert.equal(jan2.date, "2026-01-02");
  assert.equal(jan3.date, "2026-01-03");
});
