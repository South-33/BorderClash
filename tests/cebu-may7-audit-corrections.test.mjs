import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("May 7 Cebu record keeps the meeting, trust-building, and AOT extension in scope",()=>{
  const event=readJsonl("data/timeline/2026-05.jsonl").find((row)=>row.id==="ks76mxdwfj9ftn19y8t0yn8sf586br4w");
  const articles=readJsonl("data/news/2026-05.jsonl");
  const reuters=articles.find((row)=>row.id==="k972918z4jb7nmfaw92hqmdfbx86cxp6");
  const pna=articles.find((row)=>row.id==="k97eby74wwvw3gmadkttjg23hx86b9b1");
  assert.ok(event); assert.ok(reuters); assert.ok(pna);
  assert.equal(event.date,"2026-05-07");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.description,/On May 7/u);
  assert.match(event.description,/restraint, trust-building and de-escalation/u);
  assert.match(event.description,/extend the ASEAN Observer Team mandate until July 2026/u);
  assert.deepEqual(event.evidenceIds,["k972918z4jb7nmfaw92hqmdfbx86cxp6","k97eby74wwvw3gmadkttjg23hx86b9b1"]);
  assert.equal(reuters.category,"diplomatic");
  assert.match(reuters.summary,/On May 7/u);
  assert.match(pna.summary,/On May 7/u);
  assert.doesNotMatch(`${event.title} ${event.description}`,/landmark trilateral summit|ordered their foreign ministries/iu);
});
