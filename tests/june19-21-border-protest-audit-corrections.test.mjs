import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("June border protest cluster keeps one June 19 Cambodian protest and one June 21 Thai response", () => {
  const timeline = readJsonl("data/timeline/2026-06.jsonl");
  const protest = timeline.find((row) => row.id === "ks73d7qcr028smsvg9yk486mkh891axm");
  const response = timeline.find((row) => row.id === "ks72zrn2vpeybsz9xwmbktbcwh895efr");

  assert.ok(protest);
  assert.equal(protest.date, "2026-06-19");
  assert.equal(protest.timeOfDay, undefined);
  assert.equal(protest.importance, 75);
  assert.match(protest.title, /Cambodia Protests Alleged Thai Border Actions/u);
  assert.match(protest.description, /actions it alleged Thai forces had carried out on June 17/u);
  assert.match(protest.description, /remain Cambodia's allegations/u);
  assert.deepEqual(protest.evidenceIds, ["jn732fw7gmc4rd110wscey72y5890gt4"]);

  assert.ok(response);
  assert.equal(response.date, "2026-06-21");
  assert.equal(response.timeOfDay, undefined);
  assert.match(response.title, /Joint Fact-Finding/u);
  assert.match(response.description, /rejected Cambodia's June 19 accusations/u);
  assert.match(response.description, /represent Thailand's position/u);
  assert.deepEqual(response.evidenceIds, [
    "js73z0agthb4szrj5tk8na75q189405d",
    "js74rbsdsdam4r9kg0qekcbry58945bs",
  ]);
});

test("June protest publication-date and conflated duplicates are absent", () => {
  const timeline = readJsonl("data/timeline/2026-06.jsonl");
  for (const id of [
    "ks7em12qyjcbn0bf3hfwpbx0vs894f6d",
    "ks7eyzp2tj5f562bw1w2xyrzh9890p7t",
    "ks7cjxp8qfv6qk38fr01dv81kx890h0t",
    "ks7dtpdkhfnzpq8jwzaj263w418929r5",
  ]) {
    assert.equal(timeline.some((row) => row.id === id), false, id);
  }
});

test("June protest and Thai response source chains carry shared provenance", () => {
  const news = readJsonl("data/news/2026-06.jsonl");
  const byId = new Map(news.map((row) => [row.id, row]));

  for (const id of [
    "jn732fw7gmc4rd110wscey72y5890gt4",
    "jn79wrg49ezr8q4crskj3cg9d5891bt1",
    "js7cnyqznpxwfmgvv2wmk5s0hs893gr6",
  ]) {
    assert.equal(byId.get(id)?.provenanceId, "cambodia-mfa-border-protest-jun19");
  }

  for (const id of [
    "js73z0agthb4szrj5tk8na75q189405d",
    "js74rbsdsdam4r9kg0qekcbry58945bs",
    "js70b63f1994ksx9he2bd71pbx895zf3",
  ]) {
    assert.equal(byId.get(id)?.provenanceId, "thailand-jic-border-response-jun21");
  }
});
