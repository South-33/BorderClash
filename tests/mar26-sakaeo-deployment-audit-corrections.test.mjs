import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const id="ks7frh17km0gfytymd3j67nez583qbm5";
const evidenceId="a248f362f39748d1f922a1dedf466603";
const rows=()=>readFileSync("data/timeline/2026-03.jsonl","utf8").split(String.fromCharCode(10)).map(x=>x.trim()).filter(Boolean).map(JSON.parse);
test("Mar 26 Sa Kaeo deployment row removes unsupported time and uses captured replacement",()=>{
 const e=rows().find(x=>x.id===id); assert.ok(e); assert.equal(e.date,"2026-03-26"); assert.equal(e.timeOfDay,undefined); assert.deepEqual(e.evidenceIds,[evidenceId]);
 assert.match(e.description,/11th Infantry Division/u); assert.match(e.description,/Ta Phraya/u); assert.match(e.description,/no exact event time/u);
});
test("localized copies preserve date, unit and location",()=>{
 const e=rows().find(x=>x.id===id);
 for(const v of [e.descriptionTh,e.descriptionKh]){ assert.ok(v.includes("26")); assert.ok(v.includes("11")); }
});
