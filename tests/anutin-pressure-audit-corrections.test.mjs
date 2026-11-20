import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Anutin Dec 22 row does not invent China neutrality or a Trump rebuttal",()=>{
  const event=readJsonl("data/timeline/2025-12.jsonl").find((row)=>row.id==="ks77mg2faxp2xgacymjw339111813sf6");
  assert.ok(event);
  assert.equal(event.date,"2025-12-22");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.title,/Will Not Be Pressured Before ASEAN Meeting/u);
  assert.match(event.description,/would not be pressured by foreign powers/u);
  assert.match(event.description,/not presented as Anutin's personal pledge/u);
  assert.doesNotMatch(`${event.title} ${event.description}`,/China is maintaining a neutral stance|President Trump's allegations|Trump.*aggression/iu);
});
