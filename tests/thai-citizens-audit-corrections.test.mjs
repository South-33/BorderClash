import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Thai citizens row distinguishes MFA advisory from observed departures",()=>{
  const event=readJsonl("data/timeline/2025-12.jsonl").find((row)=>row.id==="ks74pjx756qy175bhd1y3cjw918133kb");
  assert.ok(event);
  assert.equal(event.date,"2025-12-11");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.title,/MFA Urges Citizens to Leave Cambodia/u);
  assert.match(event.description,/official advisory and observed departures/u);
  assert.doesNotMatch(`${event.title} ${event.description}`,/first official mass repatriation|Thailand Evacuates Citizens/iu);
  assert.deepEqual(event.evidenceIds,["js7dambm5jg4wkdhkac0hxqz897x6acv","jn7184zev3sc8djjwprv1gc75n7x7txv"]);
});
