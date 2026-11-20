import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Dec 15 Thai MFA ceasefire conditions stay date-only and separate from the UN letter",()=>{
  const event=readJsonl("data/timeline/2025-12.jsonl").find((row)=>row.id==="ks744pegqcap7kpnzqfrgmaggn81264c");
  assert.ok(event);
  assert.equal(event.date,"2025-12-15");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.description,/set out three conditions for a ceasefire/u);
  assert.doesNotMatch(event.description,/non-negotiable/iu);
  assert.match(event.description,/Separately, the ministry said the foreign minister had written/u);
  assert.deepEqual(event.evidenceIds,["js768jm7pvqrajs1gvmyze6bxx7xb8rz","k971cmt6ra9pkzggagganmrypx7xakbv","js78pwwzx7qkmn91jb1ttmmnzd7xc4h1"]);
});
