import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const id="ks70bmvza4mf56tzsh3gznk0gn813sja";
const evidenceId="9215795a90cfc324cc5cb2db4af3c478";
const row=()=>readFileSync("data/timeline/2026-01.jsonl","utf8").trim().split(/\r?\n/u).map(JSON.parse).find((r)=>r.id===id);
test("Cambodia Para Games withdrawal is dated to the Jan 8 letter",()=>{
 const e=row(); assert.ok(e); assert.equal(e.date,"2026-01-08"); assert.equal(e.timeOfDay,undefined); assert.deepEqual(e.evidenceIds,[evidenceId]);
 assert.match(e.description,/January 8 letter/u); assert.match(e.description,/unforeseen circumstances/u);
});
test("Para Games row does not import safety rationale from the earlier SEA Games withdrawal",()=>{
 const e=row(); assert.match(e.description,/does not state that safety concerns were the reason/u); assert.doesNotMatch(e.title,/Safety/u);
});
