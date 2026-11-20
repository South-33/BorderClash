import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(path)=>readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const id="ks75s6ajnbc0h8q2ej4hmyqeax812y58";
const evidenceId="k9711b5vacg1w810wy9xm8b12h7xrhf9";

test("Dec 21 Trat mine incident uses captured Xinhua evidence and no invented exact time",()=>{
 const e=read("data/timeline/2025-12.jsonl").find(x=>x.id===id); assert.ok(e);
 assert.equal(e.date,"2025-12-21"); assert.equal(e.timeOfDay,undefined); assert.deepEqual(e.evidenceIds,[evidenceId]);
});

test("row keeps the Navy allegation attributed and removes unsupported amputation/new-mine claims",()=>{
 const e=read("data/timeline/2025-12.jsonl").find(x=>x.id===id);
 assert.match(e.title,/Marine Injured by Landmine/u);
 assert.match(e.description,/Royal Thai Navy spokesperson/u);
 assert.match(e.description,/spokesperson said the incident indicated/u);
 assert.match(e.description,/did not independently verify the Navy's attribution/u);
 assert.doesNotMatch(e.title,/Loses Leg|New Minefield/u);
 assert.doesNotMatch(e.description,/PMN-2|newly planted|lost a leg|lost a foot|06:00/u);
});

test("Thai and Khmer copies remove the unsupported exact time",()=>{
 const e=read("data/timeline/2025-12.jsonl").find(x=>x.id===id);
 for(const value of [e.descriptionTh,e.descriptionKh]){assert.ok(value.includes("21"));assert.ok(!value.includes("06:00"));}
});
