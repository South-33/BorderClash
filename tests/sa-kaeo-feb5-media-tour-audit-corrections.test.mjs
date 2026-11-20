import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const timeline = readJsonl("data/timeline/2026-02.jsonl");
const news = readJsonl("data/news/2026-02.jsonl");

test("Ban Khlong Phaeng row is a Feb 5 status report, not an invented demolition timestamp", () => {
  const event = timeline.find((row) => row.id === "ks77ep3ep4qegvm0czfddt5q7x812e7f");
  assert.ok(event);
  assert.equal(event.date, "2026-02-05");
  assert.equal(event.timeOfDay, "");
  assert.match(event.description, /army-led media visit/u);
  assert.match(event.description, /already removed and cleared more than 389 structures/u);
  assert.match(event.description, /does not establish the date when the demolitions occurred/u);
  assert.match(event.description, /Thailand and Cambodia disagree/u);
});

test("Ban Nong Chan scam-site row uses the briefing location and supported 15:00 time", () => {
  const event = timeline.find((row) => row.id === "ks7d85a1m01x3shkwkm0w2dtmn816j6w");
  assert.ok(event);
  assert.equal(event.date, "2026-02-05");
  assert.equal(event.timeOfDay, "15:00");
  assert.match(event.title, /Ban Nong Chan/u);
  assert.match(event.description, /At 15:00/u);
  assert.match(event.description, /two buildings/u);
  assert.match(event.description, /more than 131 technology-crime case IDs/u);
  assert.match(event.description, /15:00 time is for the briefing, not the demolition/u);
  assert.doesNotMatch(event.description, /Ban Khlong Phaeng sector/u);
});

test("Thai and Khmer copies preserve the corrected locations, times and attribution", () => {
  const khlong = timeline.find((row) => row.id === "ks77ep3ep4qegvm0czfddt5q7x812e7f");
  const nongChan = timeline.find((row) => row.id === "ks7d85a1m01x3shkwkm0w2dtmn816j6w");
  assert.ok(khlong && nongChan);
  for (const text of [khlong.descriptionTh, khlong.descriptionKh]) {
    assert.match(text, /389/u);
    assert.match(text, /36/u);
    assert.doesNotMatch(text, /09:00/u);
  }
  for (const text of [nongChan.descriptionTh, nongChan.descriptionKh]) {
    assert.match(text, /15:00/u);
    assert.match(text, /131/u);
  }
  assert.match(nongChan.descriptionTh, /ไทย.*กล่าว/u);
  assert.match(nongChan.descriptionKh, /ថៃ.*ចាត់ទុក/u);
});

test("stored source summaries no longer misdate or mislocate the reported activity", () => {
  const ch8 = news.find((row) => row.id === "js7bs64ypy4zns117ym7awywkx80ke0f");
  const manager = news.find((row) => row.id === "js79xsgvc44qenfbjt616xtvs1817njs");
  assert.ok(ch8 && manager);
  assert.match(ch8.summary, /does not date the demolitions themselves/u);
  assert.match(manager.summary, /15:00 briefing in Ban Nong Chan/u);
  assert.match(manager.summary, /more than 131 technology-crime case IDs/u);
  assert.doesNotMatch(manager.summary, /two large buildings on Thai soil/u);
});
