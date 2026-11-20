import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const id="ks7fw662erc9c2wjhrx023hjrx813dke";
const row=()=>readFileSync("data/timeline/2026-01.jsonl","utf8").trim().split(/\r?\n/u).map(JSON.parse).find((r)=>r.id===id);
test("Jan 26 Tea Banh peace-talk row reflects the commander's premature wording",()=>{
 const e=row(); assert.ok(e); assert.equal(e.date,"2026-01-26"); assert.equal(e.timeOfDay,undefined);
 assert.match(e.title,/Premature/u); assert.match(e.description,/received a message/u); assert.match(e.description,/Plan B/u);
});
test("Jan 26 row no longer states the peace proposal was rejected",()=>{
 const e=row(); assert.doesNotMatch(e.title,/Rejected/u); assert.doesNotMatch(e.description,/rejected/u); assert.match(e.description,/no exact event time/u);
});
