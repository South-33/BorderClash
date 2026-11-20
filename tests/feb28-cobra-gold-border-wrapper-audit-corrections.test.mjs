import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const cobraGoldId = "ks7273jhysrkwptq2e5dxjb0mh825zzr";
const mixedDailyNewsId = "js7bq4rcpawmtj0y1k2b4qvnd1825313";
const unhrcId = "ks712p9te23mac951901mv76dn81xctm";

test("Cobra Gold is not retained as a standalone Cambodia-border milestone", () => {
  const timeline = readJsonl("data/timeline/2026-02.jsonl");
  assert.equal(timeline.some((row) => row.id === cobraGoldId), false);
});

test("the mixed Cobra Gold/UNHRC wrapper is retained only as archived evidence", () => {
  const article = readJsonl("data/news/2026-02.jsonl").find((row) => row.id === mixedDailyNewsId);
  assert.ok(article);
  assert.equal(article.status, "archived");
  assert.match(article.title, /Cobra Gold 2026/u);
  assert.match(article.title, /UNHRC/u);
});

test("the border-relevant diplomatic exchange remains on its supported Feb 24 date", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === unhrcId);
  assert.ok(event);
  assert.equal(event.date, "2026-02-24");
  assert.match(event.title, /Cambodia and Thailand Trade Border Accusations/u);
  assert.match(event.description, /Prak Sokhonn alleged/u);
  assert.match(event.description, /Sihasak Phuangketkeow rejected/u);
});
