import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("July 19 Oddar Meanchey row covers engineering activity, not the later protest",()=>{
  const event=readJsonl("data/timeline/2026-07.jsonl").find((row)=>row.id==="ks71bmpmwqg0bfqg88wkg8d3a18b5t0p");
  const article=readJsonl("data/news/2026-07.jsonl").find((row)=>row.id==="jn7c3ehz1jc32jmxez3hpwkbtd8b4s6c");
  assert.ok(event);
  assert.ok(article);
  assert.equal(event.date,"2026-07-19");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.title,/Through July 19/u);
  assert.match(event.description,/between July 13 and 15/u);
  assert.match(event.description,/between July 15 and 19/u);
  assert.match(event.description,/formal diplomatic protest issued on July 22 is recorded separately/u);
  assert.deepEqual(event.evidenceIds,["jn7c3ehz1jc32jmxez3hpwkbtd8b4s6c"]);
  assert.match(article.summary,/On July 22/u);
  assert.match(article.summary,/between July 13 and July 15/u);
  assert.match(article.summary,/between July 15 and July 19/u);
});
