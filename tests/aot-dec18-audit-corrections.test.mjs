import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Dec 18 AOT row is a reaffirmation, not the first observer agreement",()=>{
  const event=readJsonl("data/timeline/2025-12.jsonl").find((row)=>row.id==="ks7727rvr4dh38m6t77b05dp1s812df1");
  assert.ok(event);
  assert.equal(event.date,"2025-12-18");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.description,/continued support for ASEAN monitoring/u);
  assert.match(event.description,/not the first agreement/u);
  assert.doesNotMatch(event.description,/first successful regional consensus/iu);
  assert.deepEqual(event.evidenceIds,["k978a8q8j3qa26rec2vkdzem097xg1qh"]);
});
