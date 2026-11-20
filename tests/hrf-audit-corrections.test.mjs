import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("HRF Dec 27 row keeps report date separate from Dec 25 snapshot and ceasefire framing",()=>{
  const event=readJsonl("data/timeline/2025-12.jsonl").find((row)=>row.id==="ks747n74yshhyhp2g1agt6j2wx813vfm");
  const article=readJsonl("data/news/2025-12.jsonl").find((row)=>row.id==="k97eamw8mfdnwj0966qabb4qk97y2sm2");
  assert.ok(event); assert.ok(article);
  assert.equal(event.date,"2025-12-27");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.description,/covering December 13-26/u);
  assert.match(event.description,/644,589 people displaced as of December 25/u);
  assert.match(event.description,/1,311 schools were closed/u);
  assert.doesNotMatch(`${event.title} ${event.description}`,/ceasefire takes effect|Ceasefire Status/iu);
  assert.match(article.summary,/dated December 27 and covering December 13-26/u);
  assert.match(article.summary,/as of December 25/u);
});
