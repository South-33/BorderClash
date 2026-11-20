import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Dec 17 Cambodian casualty snapshot keeps ministry figures and attack claims attributed",()=>{
  const event=readJsonl("data/timeline/2025-12.jsonl").find((row)=>row.id==="ks76n24cm9c63pb112cy222vk1813qdm");
  assert.ok(event);
  assert.equal(event.date,"2025-12-17");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.title,/Defence Ministry Reports 17 Civilian Deaths, 77 Injuries/u);
  assert.match(event.description,/more than 438,000 people/u);
  assert.match(event.description,/remain Cambodian government allegations/u);
  assert.doesNotMatch(event.description,/Cambodia confirmed/iu);
});
