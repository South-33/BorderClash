import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Jan 13 return snapshot does not mix in the Jan 10 school reopening count",()=>{
  const event=readJsonl("data/timeline/2026-01.jsonl").find((row)=>row.id==="ks77wkjhmm1q0vvdsrhhhk3g4s813jby");
  const article=readJsonl("data/news/2026-01.jsonl").find((row)=>row.id==="k973gqz2f0fdgn10vz30tfgfed7z5xna");
  assert.ok(event); assert.ok(article);
  assert.equal(event.date,"2026-01-13");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.description,/490,000/u);
  assert.match(event.description,/more than 640,000/u);
  assert.match(event.description,/following the December 27 ceasefire/u);
  assert.doesNotMatch(`${event.title} ${event.description}`,/975 schools|schools have reopened/iu);
  assert.deepEqual(event.evidenceIds,["k973gqz2f0fdgn10vz30tfgfed7z5xna","jn70p272cdatvymfgfmkzh9p1d7z5e5w"]);
  assert.match(article.summary,/On January 13/u);
  assert.match(article.summary,/about 490,000 of more than 640,000 displaced people had returned home/u);
  assert.doesNotMatch(article.summary,/975 schools|schools have reopened/iu);
});
