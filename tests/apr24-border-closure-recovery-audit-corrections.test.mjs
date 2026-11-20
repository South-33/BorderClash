import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=(p)=>readFileSync(p,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const id="ks7c86ypqayv17wwmga3mxp4vs85hdav";
const evidence="js750dj35vv1jnh0am9a2e44hd85gnx8";
test("Apr 24 closure row is a conditional ministerial restatement without invented exact time",()=>{const r=read("data/timeline/2026-04.jsonl").find(x=>x.id===id);assert.ok(r);assert.equal(r.date,"2026-04-24");assert.equal(r.timeOfDay,"");assert.deepEqual(r.evidenceIds,[evidence]);assert.match(r.title,/pending ceasefire compliance/i);assert.match(r.description,/no current plans to reopen/u);assert.match(r.description,/RBC, GBC and JBC/u);assert.match(r.description,/ministerial restatement/u);assert.doesNotMatch(r.description,/formal exit|pressure Cambodia/u);});
test("Thai and Khmer copies preserve conditional reopening and remove 10:00",()=>{const r=read("data/timeline/2026-04.jsonl").find(x=>x.id===id);for(const v of [r.descriptionTh,r.descriptionKh]){assert.ok(v.length>120);assert.ok(!v.includes("10:00"));assert.ok(v.includes("RBC")&&v.includes("GBC")&&v.includes("JBC"));}});
test("cited Thaiger capture summary matches the bounded claim",()=>{const a=read("data/news/2026-04.jsonl").find(x=>x.id===evidence);assert.ok(a);assert.equal(a.source,"The Thaiger");assert.match(a.summary,/remain closed|stays shut|stay closed/i);});
