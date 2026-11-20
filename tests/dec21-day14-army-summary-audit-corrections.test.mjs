import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const id="ks71t00y74s2ehcgt3wjdn1b3n813ykn";
const evidenceId="js7c2as3dnq259vx2t87w8t9fs7xrkd6";
const row=()=>readFileSync("data/timeline/2025-12.jsonl","utf8").trim().split(/\r?\n/u).map(JSON.parse).find((r)=>r.id===id);
test("Dec 21 day-14 situation summary uses captured Army Regions report",()=>{
 const e=row(); assert.ok(e); assert.equal(e.date,"2025-12-21"); assert.equal(e.timeOfDay,undefined); assert.deepEqual(e.evidenceIds,[evidenceId]);
 assert.match(e.description,/14th day/u); assert.match(e.description,/Ban Khlong Phaeng/u); assert.match(e.description,/Pha Mor E-Daeng/u);
});
test("Dec 21 summary removes unsupported Poipet and exact-time claims",()=>{
 const e=row(); assert.doesNotMatch(e.description,/Poipet|Phu Ma Khuea/u); assert.match(e.description,/18:00 only as the cutoff/u);
});
