import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Dec 31 soldier repatriation keeps supported 10:00 handover and excludes later palace events",()=>{
  const event=readJsonl("data/timeline/2025-12.jsonl").find((row)=>row.id==="ks75ngagezt5e3ycx5p75r1byh8126rm");
  assert.ok(event);
  assert.equal(event.date,"2025-12-31");
  assert.equal(event.timeOfDay,"10:00");
  assert.match(event.description,/At 10:00 on December 31/u);
  assert.match(event.description,/72-hour ceasefire period/u);
  assert.match(event.description,/ASEAN Observer Team and the International Committee of the Red Cross/u);
  assert.doesNotMatch(event.description,/royal audience|King Sihamoni|Royal Palace/iu);
  assert.deepEqual(event.evidenceIds,["js79xebrj71hfs1w9qpr2xj64d7yc3dz","jn7ebt93mvmzmmywyryh92cc5h7ycjak"]);
});
