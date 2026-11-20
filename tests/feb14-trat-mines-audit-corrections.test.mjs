import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
const eventId="ks70q9wvxr40vcfnkt622rfp9s816ddd"; const evidenceId="js7369hewgav5f25pbffdveqxs817cm3";
test("Feb 14 mine row keeps the supported operation date without an invented time",()=>{
 const e=readJsonl("data/timeline/2026-02.jsonl").find(r=>r.id===eventId); assert.ok(e);
 assert.equal(e.date,"2026-02-14"); assert.equal(e.timeOfDay,undefined); assert.match(e.title,/Thai Navy Says Six New-Condition PMN-2/u);
});
test("mine origin, responsibility, and legal conclusions stay attributed",()=>{
 const e=readJsonl("data/timeline/2026-02.jsonl").find(r=>r.id===eventId);
 assert.match(e.description,/The Navy said its inspection concluded/u); assert.match(e.description,/Thai Navy claims/u); assert.match(e.description,/not independently verified/u);
});
test("Thai and Khmer preserve date, mine types, counts, and attribution",()=>{
 const e=readJsonl("data/timeline/2026-02.jsonl").find(r=>r.id===eventId);
 for(const value of ["PMN-2","6","14","PMN-1","3","POMZ","1"]){assert.ok(e.descriptionTh.includes(value),`Thai: ${value}`); assert.ok(e.descriptionKh.includes(value),`Khmer: ${value}`);}
 assert.match(e.descriptionTh,/ข้อกล่าวหาของกองทัพเรือไทย/u); assert.match(e.descriptionKh,/ការអះអាងរបស់កងទ័ពជើងទឹកថៃ/u);
});
test("evidence summary reflects the Navy attribution and nearby mine counts",()=>{
 const a=readJsonl("data/news/2026-02.jsonl").find(r=>r.id===evidenceId); assert.ok(a);
 assert.match(a.summary,/Royal Thai Navy statement/u); assert.match(a.summary,/six new-condition PMN-2/u); assert.match(a.summary,/three PMN-1 mines and one POMZ/u);
});
