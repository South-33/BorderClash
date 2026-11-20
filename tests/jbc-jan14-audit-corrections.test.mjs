import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Jan 14 JBC delay stays attributed to Cambodia and date-only",()=>{
  const event=readJsonl("data/timeline/2026-01.jsonl").find((row)=>row.id==="ks78gzcyw1t9swj2z2vhptm9vs813bzf");
  const xinhua=readJsonl("data/news/2026-01.jsonl").find((row)=>row.id==="k97cj0zy87k2tjzbfcw5w4z7rs7z6kta");
  assert.ok(event); assert.ok(xinhua);
  assert.equal(event.date,"2026-01-14");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.title,/Cambodia Says/u);
  assert.match(event.description,/State Secretariat of Border Affairs said Thailand had requested/u);
  assert.match(event.description,/second postponement/u);
  assert.match(event.description,/February election/u);
  assert.match(event.description,/new Cabinet/u);
  assert.deepEqual(event.evidenceIds,["k97cj0zy87k2tjzbfcw5w4z7rs7z6kta","jn767nvyhjgqjwmbx13bt0kjhs7z6v9c"]);
  assert.match(xinhua.summary,/On January 14/u);
  assert.match(xinhua.summary,/citing Cambodia's State Secretariat of Border Affairs/u);
});
