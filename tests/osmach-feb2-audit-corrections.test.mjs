import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Feb 2 O'Smach record stays scoped to the media visit and its observed materials",()=>{
  const event=readJsonl("data/timeline/2026-02.jsonl").find((row)=>row.id==="ks7915r2szryk55g526scmmj5h813fnz");
  const articles=readJsonl("data/news/2026-02.jsonl");
  const ap=articles.find((row)=>row.id==="k97azy6zpb6ybj0vs86ajsah1s80ekwm");
  const reuters=articles.find((row)=>row.id==="k97506ddhv3gzxqez5qsvt7c0n80eyw5");
  assert.ok(event); assert.ok(ap); assert.ok(reuters);
  assert.equal(event.date,"2026-02-02");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.title,/AP and Reuters Visit/u);
  assert.match(event.description,/On February 2/u);
  assert.match(event.description,/did not independently establish all Thai military claims/u);
  assert.deepEqual(event.evidenceIds,["k97azy6zpb6ybj0vs86ajsah1s80ekwm","k97506ddhv3gzxqez5qsvt7c0n80eyw5"]);
  assert.match(ap.summary,/On February 2/u);
  assert.match(reuters.summary,/On February 2/u);
  assert.doesNotMatch(event.description,/Cambodia lodged a strong protest|officially rejected a protest/iu);
});
