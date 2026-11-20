import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("first Thai civilian fatalities do not invent an artillery cause",()=>{
  const event=readJsonl("data/timeline/2025-12.jsonl").find((row)=>row.id==="ks75kxqrqwcax8xk8hzcgh9yk98125pw");
  assert.ok(event);
  assert.equal(event.date,"2025-12-12");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.description,/three Thai civilians had been killed/u);
  assert.match(event.description,/first civilian fatalities since the renewed fighting began/u);
  assert.match(event.description,/did not identify the specific cause/u);
  assert.doesNotMatch(event.description,/killed by artillery fire/iu);
});
