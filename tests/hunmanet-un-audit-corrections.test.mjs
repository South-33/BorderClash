import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("UN history does not retain an unsupported Hun Manet flight to New York",()=>{
  const timeline=readJsonl("data/timeline/2025-12.jsonl");
  const news=readJsonl("data/news/2025-12.jsonl");
  assert.equal(timeline.some((row)=>row.id==="ks7dt934ajwteq93w8fqtqjgws813y7r"),false);
  const keo=timeline.find((row)=>row.id==="ks73jxcv2xrnndycarvw9c4h75813hnf");
  assert.ok(keo);
  assert.match(keo.description,/Permanent Representative Keo Chhea/u);
  const legacy=news.find((row)=>row.id==="jn01c5f1ab26f66da547c3a351fa2dbe");
  assert.ok(legacy);
  assert.equal(legacy.status,"archived");
});
