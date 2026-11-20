import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Deng shuttle mission completion is dated to Dec 23 rather than its Dec 18 start",()=>{
  const event=readJsonl("data/timeline/2025-12.jsonl").find((row)=>row.id==="ks7498xn92qj77a6rz6byt5q3h812ws1");
  assert.ok(event);
  assert.equal(event.date,"2025-12-23");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.title,/Completed Dec 18-23 Shuttle Diplomacy/u);
  assert.match(event.description,/completed a December 18-23 shuttle-diplomacy trip/u);
  assert.match(event.description,/ASEAN mediation and ceasefire monitoring/u);
  assert.deepEqual(event.evidenceIds,["k97796rg5ryfmz6zrabt3ntt417xyfss","jn7ftmhf661b1w9kdmwsefmjcn7xz26x"]);
});
