import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=(p)=>readFileSync(p,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const id="ks74npb40v9yn1q20q4m6medhx813ff7"; const evidenceId="d132d117c2e2e06a47cc78f001ffe0c6";
test("Jan 8 school-closure row removes unsupported 09:00 and uses captured Cambodianess evidence",()=>{const e=read("data/timeline/2026-01.jsonl").find(x=>x.id===id);assert.ok(e);assert.equal(e.date,"2026-01-08");assert.equal(e.timeOfDay,undefined);assert.deepEqual(e.evidenceIds,[evidenceId]);});
test("row preserves the Ministry's 113 of 1,311 school update",()=>{const e=read("data/timeline/2026-01.jsonl").find(x=>x.id===id);assert.match(e.title,/113/u);assert.match(e.description,/113 of 1,311/u);for(const p of ["Banteay Meanchey","Preah Vihear","Oddar Meanchey","Pursat"]){assert.match(e.description,new RegExp(p,"u"));}assert.doesNotMatch(e.description,/support fund for teachers/u);});
test("localized copies preserve school counts and remove exact time",()=>{const e=read("data/timeline/2026-01.jsonl").find(x=>x.id===id);for(const v of [e.descriptionTh,e.descriptionKh]){assert.ok(v.includes("113"));assert.ok(v.includes("1,311"));assert.ok(!v.includes("09:00"));}});
