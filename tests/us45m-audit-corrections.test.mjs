import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Jan 9 US aid record keeps the correct announcement date and independent evidence",()=>{
  const event=readJsonl("data/timeline/2026-01.jsonl").find((row)=>row.id==="ks78t9yzpepadeqmzs2rr5cybd812w3m");
  const reuters=readJsonl("data/news/2026-01.jsonl").find((row)=>row.id==="k97ddg15x3n15f840fxy0hjrbd7z4r28");
  assert.ok(event); assert.ok(reuters);
  assert.equal(event.date,"2026-01-09");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.description,/On January 9/u);
  assert.match(event.description,/\$15 million/u);
  assert.match(event.description,/\$10 million/u);
  assert.match(event.description,/\$20 million/u);
  assert.deepEqual(event.evidenceIds,["k97ddg15x3n15f840fxy0hjrbd7z4r28","k9784zey11j76kfetp09nkpz4d7z5qt1"]);
  assert.match(reuters.summary,/On January 9/u);
  assert.match(reuters.summary,/\$45 million/u);
});
