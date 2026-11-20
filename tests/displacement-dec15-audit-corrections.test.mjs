import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Dec 15 displacement row uses the source-supported Cambodia-only 18:00 snapshot",()=>{
  const event=readJsonl("data/timeline/2025-12.jsonl").find((row)=>row.id==="ks782mffgap3yknjwp21ev5epd813j64");
  assert.ok(event);
  assert.equal(event.date,"2025-12-15");
  assert.equal(event.timeOfDay,"18:00");
  assert.match(event.title,/421,853 People Displaced by 18:00/u);
  assert.match(event.description,/126,204 families, or 421,853 people/u);
  assert.match(event.description,/Cambodia-only government snapshot/u);
  assert.doesNotMatch(`${event.title} ${event.description}`,/800,000|Chang International Circuit/iu);
  assert.deepEqual(event.evidenceIds,["jn71p5k5nc43hs5x06tw6rd5z97xb8mk"]);
});
