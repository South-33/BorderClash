import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const survivor="ks720j6me3bf9sadyv217vacvs8462y1", duplicate="ks7c53y7vpt5dfpe023f83mb1584ycmg", evidenceId="d4c5a71c8f667677d0b1d84768ea0c76";
const rows=()=>readFileSync("data/timeline/2026-04.jsonl","utf8").split(String.fromCharCode(10)).map(x=>x.trim()).filter(Boolean).map(JSON.parse);
test("April arrest duplicate is consolidated into the specific Chea Vuthy event",()=>{
 const all=rows(), e=all.find(x=>x.id===survivor); assert.ok(e); assert.equal(all.some(x=>x.id===duplicate),false);
 assert.equal(e.date,"2026-04-01"); assert.equal(e.timeOfDay,undefined); assert.deepEqual(e.evidenceIds,[evidenceId]);
 assert.match(e.description,/defrocked and arrested/u); assert.match(e.description,/charged him on April 2/u);
});
test("Chea Vuthy record keeps the legal action attributed to LICADHO without sweeping crackdown claims",()=>{
 const e=rows().find(x=>x.id===survivor); assert.match(e.description,/LICADHO reported/u); assert.match(e.description,/does not characterize the case/u);
 assert.doesNotMatch(e.description,/silencing people|stopping them from sharing the truth/u);
});
