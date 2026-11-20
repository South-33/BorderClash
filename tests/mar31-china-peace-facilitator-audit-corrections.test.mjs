import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const previewId = "ks70ef8j5rqx328wpd1rwb8h1n844xgk";
const meetingId = "ks75qq5e6x3dq40zf7ghga6ctd85bdkt";
const evidenceId = "jn793xk733mqb9z7jw58cxcggh8445xd";

test("China-Cambodia preview record is dated to the March 31 courtesy call", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === previewId);
  assert.ok(event);
  assert.equal(event.date, "2026-03-31");
  assert.equal(event.timeOfDay ?? "", "");
  assert.match(event.title, /Facilitate Border Peace/u);
  assert.match(event.description, /Wang Wenbin/u);
  assert.match(event.description, /peace facilitator/u);
  assert.match(event.description, /permanent ceasefire/u);
});

test("preview does not claim the later 2+2 meeting had already happened", () => {
  const preview = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === previewId);
  const meeting = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === meetingId);
  assert.ok(preview);
  assert.ok(meeting);
  assert.match(preview.description, /forthcoming 2\+2 dialogue/u);
  assert.match(preview.description, /had not yet occurred/u);
  assert.equal(meeting.date, "2026-04-22");
  assert.match(meeting.title, /Hold First Foreign-Defense '2\+2' Strategic Dialogue/u);
});

test("Thai and Khmer copy preserve the March 31 date and future-meeting distinction", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === previewId);
  assert.ok(event);
  for (const field of ["descriptionTh", "descriptionKh"]) {
    assert.match(event[field], /31/u);
    assert.match(event[field], /2\+2/u);
  }
});

test("captured ANN evidence distinguishes March 31 remarks from the forthcoming 2+2", () => {
  const article = readJsonl("data/news/2026-04.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.match(article.summary, /March 31 courtesy call/u);
  assert.match(article.summary, /peace facilitator/u);
  assert.match(article.summary, /meeting had not yet occurred/u);
});
