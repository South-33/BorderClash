import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=(p)=>readFileSync(p,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const id="ks7ext79vxtekgrr3v7zx5c1ds84hjb8";
test("April 8 Japan handover removes unsupported 09:00 and incorrect equipment",()=>{
 const row=read("data/timeline/2026-04.jsonl").find(x=>x.id===id);
 assert.equal(row.date,"2026-04-08");
 assert.equal(row.timeOfDay,undefined);
 assert.match(row.description,/radio transceivers/u);
 assert.match(row.description,/LCD displays/u);
 assert.doesNotMatch(row.description,/specialized drones and rescue boats/u);
});
test("captured Embassy source distinguishes project vessel from ceremony handover",()=>{
 const row=read("data/timeline/2026-04.jsonl").find(x=>x.id===id);
 assert.match(row.description,/diving support vessel/u);
 assert.match(row.description,/does not say a vessel, drones or rescue boats were handed over/u);
 assert.deepEqual(row.evidenceIds,["7fa7b61e020caf3bba55de12729485fc"]);
});
test("Thai and Khmer copies preserve equipment and exact-time uncertainty",()=>{
 const row=read("data/timeline/2026-04.jsonl").find(x=>x.id===id);
 for(const v of [row.descriptionTh,row.descriptionKh]){assert.ok(v.includes("LCD")); assert.ok(v.includes("AOT"));}
});
