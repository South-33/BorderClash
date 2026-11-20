import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Dec 18 OHCHR warning keeps national casualty tallies attributed and date-only",()=>{
  const event=readJsonl("data/timeline/2025-12.jsonl").find((row)=>row.id==="ks79w7tgdxe3pdrn65f8kbqwzn812tr8");
  const un=readJsonl("data/news/2025-12.jsonl").find((row)=>row.id==="k977s3pxgj9rd19ze3xcg2gned7xj729");
  assert.ok(event); assert.ok(un);
  assert.equal(event.date,"2025-12-18");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.description,/On December 18/u);
  assert.match(event.description,/Cambodia had reported 18 civilian fatalities and Thailand one civilian death/u);
  assert.match(event.description,/about 750,000 people/u);
  assert.doesNotMatch(event.description,/UN reports 750,000|citing 18 Cambodian/iu);
  assert.match(un.summary,/On December 18/u);
  assert.match(un.summary,/OHCHR said Cambodia had reported 18 civilian fatalities/u);
});
