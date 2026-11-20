import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Trump Dec 22 Florida remarks remain Dec 23 in UTC+07 without stronger war-start claim",()=>{
  const event=readJsonl("data/timeline/2025-12.jsonl").find((row)=>row.id==="ks7aacrc32pjs7wqbevbw6k9ps812r1v");
  const news=readJsonl("data/news/2025-12.jsonl");
  assert.ok(event);
  assert.equal(event.date,"2025-12-23");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.description,/evening of December 22 in Florida \(December 23 in UTC\+07\)/u);
  assert.match(event.description,/started up again/u);
  assert.match(event.description,/did not establish that Thailand had started the entire border war/u);
  assert.doesNotMatch(`${event.title} ${event.description}`,/Thailand initiated the hostilities|started the war first/iu);
  assert.deepEqual(event.evidenceIds,["0da2a537cf74b7a08bf74a82119077a0","477ef0cc3b9a2656de180d9ff9d1b842"]);
  assert.ok(news.some((row)=>row.id==="0da2a537cf74b7a08bf74a82119077a0"));
  assert.ok(news.some((row)=>row.id==="477ef0cc3b9a2656de180d9ff9d1b842"));
  assert.equal(news.some((row)=>row.id==="981b787908a92bc12f75a76ad7b60d2f"),false);
});
