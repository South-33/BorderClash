import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Hun Manet Dec 30 address does not turn an interim civilian count into a final toll",()=>{
  const event=readJsonl("data/timeline/2025-12.jsonl").find((row)=>row.id==="ks752fjkbwz4n45bg5k4en2tb18131ak");
  assert.ok(event);
  assert.equal(event.date,"2025-12-30");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.description,/not a surrender or cession of territory/u);
  assert.match(event.description,/by that point/u);
  assert.doesNotMatch(event.description,/final toll/iu);
  assert.match(event.description,/32 Cambodian civilians had been killed and 93 injured/u);
});
