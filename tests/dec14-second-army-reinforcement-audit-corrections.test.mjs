import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const id="ks7fwj0xtj4wcg6r0rr1xpdz49813ya6";
const evidence="dfdb4749759468cde54868903179bc87";
const row=()=>readFileSync("data/timeline/2025-12.jsonl","utf8").trim().split(/\r?\n/u).map(JSON.parse).find(r=>r.id===id);
test("Dec 14 BM-21 reinforcement report is attributed to Thai 2nd Army",()=>{
 const e=row(); assert.ok(e); assert.equal(e.date,"2025-12-14"); assert.equal(e.timeOfDay,undefined); assert.deepEqual(e.evidenceIds,[evidence]);
 assert.match(e.title,/Thai 2nd Army/u); assert.match(e.description,/reinforced artillery and BM-21/u); assert.match(e.description,/Thai military's account/u);
});
test("Dec 14 situation-summary cutoff is not stored as an event time",()=>{
 const e=row(); assert.match(e.description,/09:00 reference is the cutoff/u); assert.doesNotMatch(e.description,/contradicts earlier reports|prolonged engagement/u);
});
