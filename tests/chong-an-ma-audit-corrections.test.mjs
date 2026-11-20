import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Chong An Ma hill-control row uses the Dec 15 operation date and relevant evidence",()=>{
  const event=readJsonl("data/timeline/2025-12.jsonl").find((row)=>row.id==="ks76c9mjpvyrz6m0078ts84w8x813j40");
  const article=readJsonl("data/news/2025-12.jsonl").find((row)=>row.id==="3c36fbcfbbc65fd353891bfbfff0f6ba");
  assert.ok(event); assert.ok(article);
  assert.equal(event.date,"2025-12-15");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.title,/Hills 677 and 500 at Chong An Ma/u);
  assert.match(event.description,/evening of December 15/u);
  assert.match(event.description,/remains attributed to the Thai source/u);
  assert.doesNotMatch(`${event.title} ${event.description}`,/Ban Nong Ya Kaew|17th Thai soldier|equestrian statue/iu);
  assert.deepEqual(event.evidenceIds,["3c36fbcfbbc65fd353891bfbfff0f6ba"]);
  assert.match(article.summary,/evening of December 15/u);
});
