import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const id="ks79sfvzfzn9hpqzh5pyd9cz29812cyy";
const evidenceId="js7ct8e7n57m15qcrxrz6zaps17ytn9s";
const rows=()=>readFileSync("data/timeline/2026-01.jsonl","utf8").trim().split(/\r?\n/u).map(JSON.parse);
test("Jan 7 drone row removes unsupported 21:00 and attributes Cambodia's allegation",()=>{
 const e=rows().find(r=>r.id===id); assert.ok(e); assert.equal(e.date,"2026-01-07"); assert.equal(e.timeOfDay,undefined);
 assert.deepEqual(e.evidenceIds,[evidenceId]); assert.match(e.title,/Interior Ministry Says/u); assert.match(e.description,/Cambodia's official account/u);
});
test("Jan 7 drone row preserves captured counts and reporting window",()=>{
 const e=rows().find(r=>r.id===id); for(const s of ["27 Thai drones","25 over Preah Vihear","2 over Pursat","06:00 on January 7","06:00 on January 8"]) assert.ok(e.description.includes(s),s);
 for(const v of [e.descriptionTh,e.descriptionKh]) { assert.ok(v.includes("27")); assert.ok(v.includes("25")); assert.ok(v.includes("2")); }
});
