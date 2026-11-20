import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const id="ks72wds814rb4sxpzn9pe8ke35812gjf";
const row=()=>readFileSync("data/timeline/2025-12.jsonl","utf8").trim().split(/\r?\n/u).map(JSON.parse).find((r)=>r.id===id);
test("Dec 16 NHRC statement is attributed and has no unsupported exact time",()=>{
 const e=row(); assert.ok(e); assert.equal(e.date,"2025-12-16"); assert.equal(e.timeOfDay,undefined);
 assert.match(e.description,/NHRC/u); assert.match(e.description,/Sao Thong Chai/u); assert.match(e.description,/no exact event time/u);
});
test("Dec 16 NHRC row keeps responsibility and legal claims as the commission's position",()=>{
 const e=row(); assert.match(e.description,/NHRC's position/u); assert.match(e.description,/not use civilians as human shields/u);
});
