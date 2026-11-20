import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Nattapon fuel-restriction remarks are dated Dec 16 and avoid editorial strategy labels",()=>{
  const event=readJsonl("data/timeline/2025-12.jsonl").find((row)=>row.id==="ks77tk5ynfcf75jz88az01f8cd813nhv");
  const article=readJsonl("data/news/2025-12.jsonl").find((row)=>row.id==="js7ctt2mdbz5m6yxnsjzytxs1n7xd3zr");
  assert.ok(event); assert.ok(article);
  assert.equal(event.date,"2025-12-16");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.title,/Defends Fuel and Supply Restrictions/u);
  assert.match(event.description,/peaceful measure intended to limit Cambodia's operational capacity/u);
  assert.match(event.description,/clearly and openly ceased hostile action/u);
  assert.doesNotMatch(`${event.title} ${event.description}`,/strangulation strategy/iu);
  assert.match(article.summary,/reported on December 16/u);
});
