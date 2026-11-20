import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Jan 3 withdrawal demand stays separate from Jan 4 Boeung Trakuon humanitarian figures",()=>{
  const event=readJsonl("data/timeline/2026-01.jsonl").find((row)=>row.id==="ks796hvd3wjaj6m4h5sea7ks0x81376b");
  const afp=readJsonl("data/news/2026-01.jsonl").find((row)=>row.id==="k9792yh5vb06scwqq734z25g617yhneb");
  assert.ok(event); assert.ok(afp);
  assert.equal(event.date,"2026-01-03");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.description,/On January 3/u);
  assert.match(event.description,/areas it says are Cambodian territory/u);
  assert.match(event.description,/Thai Army rejected claims/u);
  assert.doesNotMatch(`${event.title} ${event.description}`,/1,365|6,000|excavator|annexation/iu);
  assert.deepEqual(event.evidenceIds,["k9792yh5vb06scwqq734z25g617yhneb","js7d0m6cm1684s0p1m6zdj0dzx7yzpnk"]);
  assert.match(afp.summary,/On January 3/u);
  assert.match(afp.summary,/Thai Army rejected claims/u);
});
