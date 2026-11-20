import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("April 23 Ta Kwai duplicate is merged into the April 22 ceremony record",()=>{
  const timeline=readJsonl("data/timeline/2026-04.jsonl");
  const target=timeline.find((row)=>row.id==="ks757wcxk2z21qh7fmj4p3bk8585b6n5");
  const duplicate=timeline.find((row)=>row.id==="ks7e052qmr5s4fmaw17h4yzgd985dzn6");
  const article=readJsonl("data/news/2026-04.jsonl").find((row)=>row.id==="jn74sag2tj6xjkbxejw7y700sh85e68x");
  assert.ok(target); assert.equal(duplicate,undefined); assert.ok(article);
  assert.equal(target.date,"2026-04-22");
  assert.equal(target.timeOfDay,undefined);
  assert.match(target.title,/April 22 Ceremony/u);
  assert.match(target.description,/commemorating Thai soldiers killed in the 2011 clashes and fighting in 2025/u);
  assert.match(target.description,/Cambodia's Ministry of Culture and Fine Arts protested the same day/u);
  assert.deepEqual(target.evidenceIds,["jn74sag2tj6xjkbxejw7y700sh85e68x","jn74w22am9t5chjx3qcak3d62s85a7nz","js7faxg83js1n9xj1b9pr5vrw585dxwq"]);
  assert.match(article.summary,/On April 22/u);
});
