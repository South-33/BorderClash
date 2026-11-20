import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Poipet return plan is airline facilitation, not a government airlift",()=>{
  const event=readJsonl("data/timeline/2025-12.jsonl").find((row)=>row.id==="ks74sq6axvnmtf4dty1wb8x6ws812z65");
  assert.ok(event);
  assert.equal(event.date,"2025-12-14");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.description,/about 5,000 Thai citizens were stranded/u);
  assert.match(event.description,/about 1,000 seats per day available from Siem Reap/u);
  assert.match(event.description,/travel facilitation rather than a government-chartered mass airlift/u);
  assert.doesNotMatch(`${event.title} ${event.description}`,/urgent airlift|safe passage/iu);
  assert.deepEqual(event.evidenceIds,["jnb9b64d5957f2008737d05d32cd6e0d","js7cp5e74p92tjecyg02pf208n7x91t4"]);
});
