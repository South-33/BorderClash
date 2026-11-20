import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const timeline=()=>readFileSync("data/timeline/2026-02.jsonl","utf8").trim().split(/\r?\n/u).map(JSON.parse);
const news=()=>readFileSync("data/news/2026-02.jsonl","utf8").trim().split(/\r?\n/u).map(JSON.parse);
const id="ks74b8xf676yjmswxwjfyhyvnn81cg19";
const evidenceId="ddbbd4bc0ea71c61b6b74d8543a4f491";

test("Feb 18 Senate visit uses the captured Phu Sing location and no unsupported exact time",()=>{
  const e=timeline().find((r)=>r.id===id);
  assert.ok(e); assert.equal(e.date,"2026-02-18"); assert.equal(e.timeOfDay,undefined);
  assert.deepEqual(e.evidenceIds,[evidenceId]);
  assert.match(e.description,/Pha Phya Kouprey/u);
  assert.match(e.description,/Phrai Phatthana/u);
  assert.match(e.description,/Phu Sing/u);
  assert.doesNotMatch(e.description,/Chong Sa-ngam/u);
});

test("Feb 18 Senate evidence registry matches the captured publisher text",()=>{
  const a=news().find((r)=>r.id===evidenceId);
  assert.ok(a); assert.match(a.title,/Pha Phya Kouprey/u); assert.match(a.summary,/Phu Sing/u);
  assert.doesNotMatch(a.title+a.summary,/Chong Sa-ngam/u);
  assert.equal(news().some((r)=>r.id==="5c60e92f1a8598f562ed216ea0766028"),false);
});
