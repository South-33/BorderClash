import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("May 26 New York public debate and bilateral meeting remain distinct and correctly dated",()=>{
  const timeline=readJsonl("data/timeline/2026-05.jsonl");
  const publicEvent=timeline.find((row)=>row.id==="ks741zvxtjftc4etcw8eq77evx87jg33");
  const bilateral=timeline.find((row)=>row.id==="ks7e2ey4vhe1b2vmy61ceny65s87jsmt");
  assert.ok(publicEvent); assert.ok(bilateral);
  for(const event of [publicEvent,bilateral]) { assert.equal(event.date,"2026-05-26"); assert.equal(event.timeOfDay,undefined); }
  assert.match(publicEvent.title,/UN Security Council Debate/u);
  assert.match(publicEvent.description,/Deputy Prime Minister and Foreign Minister Sihasak/u);
  assert.match(publicEvent.description,/did not seek territorial claims/u);
  assert.deepEqual(publicEvent.evidenceIds,["jn7ek76sqkhhk2ekd85q5fjn6587jja1","5c82d2a4d684dc3df27e8a8476675ea3"]);
  assert.match(bilateral.title,/Foreign Ministers Meet in New York/u);
  assert.match(bilateral.description,/Prak Sokhonn met Thai Deputy Prime Minister and Foreign Minister Sihasak/u);
  assert.match(bilateral.description,/compulsory conciliation under UNCLOS/u);
  assert.match(bilateral.description,/no maritime negotiating framework was agreed/u);
  assert.deepEqual(bilateral.evidenceIds,["269d255d6c8a5246da304b26352cde94","k97afxy0v8h9461yx2ek26bf3187mjp5","js7egddnn9eaw4jt5z3yba34nh87jcp1"]);
});
test("New York evidence summaries anchor the May 26 meeting and correct Sihasak's role",()=>{
  const news=readJsonl("data/news/2026-05.jsonl");
  const khmerTimes=news.find((row)=>row.id==="k9719fsy0fx6jas7hf8da70edn87jgbg");
  const xinhua=news.find((row)=>row.id==="k97afxy0v8h9461yx2ek26bf3187mjp5");
  const bangkokPost=news.find((row)=>row.id==="js7egddnn9eaw4jt5z3yba34nh87jcp1");
  assert.match(khmerTimes.summary,/May 26 New York meeting/u);
  assert.match(khmerTimes.summary,/Thai Deputy Prime Minister and Foreign Minister Sihasak/u);
  assert.doesNotMatch(khmerTimes.summary,/Thai Prime Minister Sihasak/u);
  assert.match(xinhua.summary,/On May 26/u);
  assert.match(bangkokPost.summary,/On May 26/u);
});
