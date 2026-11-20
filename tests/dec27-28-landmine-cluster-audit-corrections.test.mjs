import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const casualtyId = "ks7cp7h2q7k1cwamtt1cbthvm1813d00";
const findingsId = "ks788ywzyqn2dn98e99vc0de218129zd";
const duplicateId = "ks7bt7d0nqkf72hx070kt363yh8586fd";
const thaiPbsId = "js7b5y7yc42ekt6nsrw4zkhdd5859x5e";
const bangkokPostId = "js7d82scwp4rftzp34jxakht557y5eq7";

test("Private Narin casualty is kept once on Dec 27 with the supported 11:30 time", () => {
  const events = readJsonl("data/timeline/2025-12.jsonl");
  const casualty = events.find((row) => row.id === casualtyId);
  assert.ok(casualty);
  assert.equal(casualty.date, "2025-12-27");
  assert.equal(casualty.timeOfDay, "11:30");
  assert.match(casualty.description, /Private Narin Ngaoprai/u);
  assert.match(casualty.description, /lost his right leg/u);
  assert.match(casualty.description, /Thailand's Foreign Ministry then filed a protest/u);
  assert.equal(events.some((row) => row.id === duplicateId), false);
});

test("Dec 28 milestone keeps TMAC findings attributed and records Cambodia's rejection", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === findingsId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-28");
  assert.equal(event.timeOfDay, "");
  assert.match(event.description, /TMAC said/u);
  assert.match(event.description, /TMAC said indicated recent mine-laying/u);
  assert.match(event.description, /Cambodia's mine-action authority had rejected similar Thai new-mine allegations/u);
  assert.doesNotMatch(event.description, /Cambodian forces laid/u);
});

test("Thai TMAC reports share provenance instead of counting as independent corroboration", () => {
  const articles = readJsonl("data/news/2025-12.jsonl");
  const thaiPbs = articles.find((row) => row.id === thaiPbsId);
  const bangkokPost = articles.find((row) => row.id === bangkokPostId);
  assert.ok(thaiPbs);
  assert.ok(bangkokPost);
  assert.equal(thaiPbs.provenanceId, "dec28-tmac-mine-claims");
  assert.equal(bangkokPost.provenanceId, "dec28-tmac-mine-claims");
  assert.match(thaiPbs.summary, /does not independently establish who laid the mines/u);
  assert.match(bangkokPost.summary, /not independently verified/u);
});

test("localized surviving rows preserve dates, attribution and readable text", () => {
  const events = readJsonl("data/timeline/2025-12.jsonl");
  for (const id of [casualtyId, findingsId]) {
    const event = events.find((row) => row.id === id);
    assert.ok(event);
    for (const text of [event.descriptionTh, event.descriptionKh]) {
      assert.doesNotMatch(text, /���|\?{3,}/u);
    }
  }
});
