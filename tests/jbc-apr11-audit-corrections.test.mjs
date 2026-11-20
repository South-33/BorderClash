import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("April 11 JBC record preserves Sihasak's not-ready statement without inventing a formal deferral",()=>{
  const event=readJsonl("data/timeline/2026-04.jsonl").find((row)=>row.id==="ks75wszs3mq585f8kg7chzk46584qsqy");
  const tcij=readJsonl("data/news/2026-04.jsonl").find((row)=>row.id==="js7cv9pdsv023m7sqzs8vvbsn184n0m7");
  assert.ok(event); assert.ok(tcij);
  assert.equal(event.date,"2026-04-11");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.title,/Not Ready/u);
  assert.match(event.description,/On April 11/u);
  assert.match(event.description,/not yet ready/u);
  assert.doesNotMatch(`${event.title} ${event.description}`,/officially deferred/iu);
  assert.deepEqual(event.evidenceIds,[
    "js7cv9pdsv023m7sqzs8vvbsn184n0m7",
    "js7awg3hy1jxad4ehq7qvbdbmx84q8md",
    "js731fwdhvsshnw28z5caeda1h84mcfa",
  ]);
  assert.match(tcij.summary,/On April 11/u);
  assert.match(tcij.summary,/between April 17 and 25/u);
});
