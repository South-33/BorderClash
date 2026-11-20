import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Hill 350 record keeps Dec 20 capture claim separate from Dec 21 confirmation",()=>{
  const event=readJsonl("data/timeline/2025-12.jsonl").find((row)=>row.id==="ks79qk7dp072tjtfts51xz4tvn813ns6");
  assert.ok(event);
  assert.equal(event.date,"2025-12-20");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.title,/Claims Capture of Hill 350 on December 20/u);
  assert.match(event.description,/On December 20/u);
  assert.match(event.description,/Reporting on December 21/u);
  assert.match(event.description,/Thai military claims about battlefield control/u);
  assert.doesNotMatch(event.description,/Hill 333|drone signal station/iu);
  assert.deepEqual(event.evidenceIds,["cf11a1d3aae4657af49b9805253d5dea","js71pwj8qxy3jys5srmmqgn3kh7xme8c","js705z0wb91n5yp7ay677jgs157xp6jd"]);
});
test("Hill 350 evidence anchors both Dec 20 and Dec 21 stages",()=>{
  const news=readJsonl("data/news/2025-12.jsonl");
  const dec20=news.find((row)=>row.id==="cf11a1d3aae4657af49b9805253d5dea");
  const thaiPost=news.find((row)=>row.id==="js71pwj8qxy3jys5srmmqgn3kh7xme8c");
  const pptv=news.find((row)=>row.id==="js705z0wb91n5yp7ay677jgs157xp6jd");
  assert.match(dec20.summary,/On December 20/u);
  assert.match(thaiPost.summary,/published on December 21/u);
  assert.match(pptv.summary,/On December 21/u);
});
