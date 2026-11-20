import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Dec 15 ASEAN postponement preserves conflicting same-day request accounts",()=>{
  const event=readJsonl("data/timeline/2025-12.jsonl").find((row)=>row.id==="ks77y120f1t13vsz0wh8n84br5813pk8");
  const article=readJsonl("data/news/2025-12.jsonl").find((row)=>row.id==="jn7ebcf3pevsech1163mx7y8657xajgm");
  assert.ok(event); assert.ok(article);
  assert.equal(event.date,"2025-12-15");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.description,/Thailand and Cambodia had both requested/u);
  assert.match(event.description,/at Thailand's request/u);
  assert.match(event.description,/moved to December 22/u);
  assert.doesNotMatch(event.title,/Thailand's Request/iu);
  assert.deepEqual(event.evidenceIds,["jn7ebcf3pevsech1163mx7y8657xajgm","k979abgdpsc3247zbzdks91jqx7xcdpm","k975c4wj5hffj30vh1h9ncabgd7xddb5"]);
  assert.match(article.summary,/On December 15/u);
});
