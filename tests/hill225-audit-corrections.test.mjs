import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Hill 225 control claim uses the Dec 24 operation date and excludes the later mine casualty",()=>{
  const event=readJsonl("data/timeline/2025-12.jsonl").find((row)=>row.id==="ks77b782dfj9hh322q54hnzh8s8138r2");
  assert.ok(event);
  assert.equal(event.date,"2025-12-24");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.title,/Second Army Region Says It Retook Hill 225/u);
  assert.match(event.description,/evening of December 24/u);
  assert.match(event.description,/remains attributed to the Thai military/u);
  assert.doesNotMatch(event.description,/Khan Ma Pass|landmine|lost his left leg|seriously injured/iu);
  assert.deepEqual(event.evidenceIds,["js7f6g37ma91k9qq8cqt6xvmmd7xyear","js76x2300wxhtasjz872z4axvn7y09ta"]);
});
