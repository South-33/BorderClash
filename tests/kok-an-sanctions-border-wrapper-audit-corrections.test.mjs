import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const falseTimelineId = "ks72cr7n641851cptn9as5rnf585kp7c";
const apId = "k97d1hq3j1nvxrfd3yhjpqdha985kqmp";
const treasuryId = "5a2037ecce09c177ad28aaa55639527f";

test("Kok An sanctions are not represented as a Thailand-Cambodia border event", () => {
  const timeline = readJsonl("data/timeline/2026-04.jsonl");
  assert.equal(timeline.some((row) => row.id === falseTimelineId), false);
});

test("Treasury record preserves the Apr 23 sanctions date and actual network scope", () => {
  const source = readJsonl("data/news/2026-04.jsonl").find((row) => row.id === treasuryId);
  assert.ok(source);
  assert.equal(source.source, "U.S. Department of the Treasury");
  assert.equal(source.category, "political");
  assert.equal(source.credibility, 100);
  assert.equal(new Date(source.publishedAt).toISOString().slice(0, 10), "2026-04-23");
  assert.match(source.summary, /Kok An and 28 individuals and entities/u);
  assert.match(source.summary, /Poipet, Sihanoukville, Bavet/u);
  assert.doesNotMatch(source.summary, /sanctions.*O'Smach|validated|validation/u);
});

test("AP story treats O'Smach as separate border-war background", () => {
  const source = readJsonl("data/news/2026-04.jsonl").find((row) => row.id === apId);
  assert.ok(source);
  assert.equal(source.source, "Associated Press via PBS News");
  assert.equal(source.category, "political");
  assert.equal(source.credibility, 90);
  assert.match(source.summary, /separately used file photographs from an O'Smach scam compound/u);
  assert.match(source.summary, /did not say the Kok An sanctions covered O'Smach/u);
  assert.match(source.summary, /did not .*endorse Thailand's military actions/u);
  assert.doesNotMatch(source.summary, /international validation|provides.*validation/u);
});
