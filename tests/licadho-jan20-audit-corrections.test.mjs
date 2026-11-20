import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Jan 20 LICADHO record keeps satellite analysis and responsibility attribution distinct",()=>{
  const event=readJsonl("data/timeline/2026-01.jsonl").find((row)=>row.id==="ks7c7na0a4q2asjn2p1bq2rhrs812e70");
  const cna=readJsonl("data/news/2026-01.jsonl").find((row)=>row.id==="k97asjj55chjhywm4cejbnabvh7zmmhd");
  const licadho=readJsonl("data/news/2026-01.jsonl").find((row)=>row.id==="96e524f4e7f0a3504ea9e844a624d4fe");
  assert.ok(event); assert.ok(cna); assert.ok(licadho);
  assert.equal(event.date,"2026-01-20");
  assert.equal(event.timeOfDay,undefined);
  assert.equal(event.category,"humanitarian");
  assert.match(event.title,/LICADHO Reports Post-Ceasefire Razing/u);
  assert.match(event.description,/satellite imagery plus media images and footage indicated/u);
  assert.match(event.description,/LICADHO attributed the clearance to Thai forces/u);
  assert.match(event.description,/Thailand's Foreign Ministry rejected allegations/u);
  assert.doesNotMatch(event.description,/satellite imagery showing Thai forces using excavators/iu);
  assert.deepEqual(event.evidenceIds,["96e524f4e7f0a3504ea9e844a624d4fe","k97asjj55chjhywm4cejbnabvh7zmmhd"]);
  assert.match(cna.summary,/On January 20/u);
  assert.match(licadho.summary,/On January 20/u);
});
