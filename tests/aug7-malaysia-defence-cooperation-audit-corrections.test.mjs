import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(path)=>readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const id="ks708nhwqp4vqaxyw0yapabcex8c5m9g";
const evidenceId="b809c129601d6b4bab7395b555bbade1";

test("August 7 meeting removes unsupported 10:00 and uses captured AKP evidence",()=>{
 const e=read("data/timeline/2026-08.jsonl").find(x=>x.id===id);
 assert.ok(e); assert.equal(e.date,"2026-08-07"); assert.equal(e.timeOfDay,undefined); assert.deepEqual(e.evidenceIds,[evidenceId]);
});

test("Malaysia commitment is limited to defence cooperation",()=>{
 const e=read("data/timeline/2026-08.jsonl").find(x=>x.id===id);
 assert.match(e.title,/Pledges to Deepen Defence Cooperation/u);
 assert.match(e.description,/Khaled reaffirmed Malaysia's commitment/u);
 assert.match(e.description,/Hun Manet, in turn, expressed appreciation/u);
 assert.doesNotMatch(e.title,/Reaffirms Support for Border Ceasefire/u);
});

test("Thai and Khmer copies remove the unsupported exact time",()=>{
 const e=read("data/timeline/2026-08.jsonl").find(x=>x.id===id);
 for(const value of [e.descriptionTh,e.descriptionKh]){assert.ok(value.includes("7"));assert.ok(!value.includes("10:00"));}
});
