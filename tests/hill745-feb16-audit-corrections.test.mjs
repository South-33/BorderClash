import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Feb 18 Hill 745 duplicate is merged into the Feb 16 Thai military report",()=>{
  const timeline=readJsonl("data/timeline/2026-02.jsonl");
  const event=timeline.find((row)=>row.id==="ks79exptnr9x6zjpvg0hhk1s1581h9kq");
  const duplicate=timeline.find((row)=>row.id==="ks7acj4ect1rdpj9bg6txg1rvx81ekrj");
  const article=readJsonl("data/news/2026-02.jsonl").find((row)=>row.id==="k971espd61em69bjk67x3abb4n81gcvt");
  assert.ok(event); assert.equal(duplicate,undefined); assert.ok(article);
  assert.equal(event.date,"2026-02-16");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.title,/Thai Military Reports Nearly 10,000/u);
  assert.match(event.description,/Second Army Region reported/u);
  assert.match(event.description,/does not independently verify the figure/u);
  assert.doesNotMatch(event.description,/largest single movement|online scam centers rise/iu);
  assert.deepEqual(event.evidenceIds,["k971espd61em69bjk67x3abb4n81gcvt"]);
  assert.match(article.summary,/on February 16/u);
  assert.match(article.summary,/attributed to Thai military reporting/u);
});
