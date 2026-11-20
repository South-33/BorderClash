import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("April 2 MOU 44 record stays at policy-announcement stage",()=>{
  const event=readJsonl("data/timeline/2026-04.jsonl").find((row)=>row.id==="ks740wg1d2k3r6g4nbkskw3nxs84259r");
  const article=readJsonl("data/news/2026-04.jsonl").find((row)=>row.id==="js72vx1xywk5s8e034kbkfxwts843xnk");
  assert.ok(event); assert.ok(article);
  assert.equal(event.date,"2026-04-02");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.title,/Sets Policy to Cancel/u);
  assert.match(event.description,/policy commitment, not the completed legal termination/u);
  assert.doesNotMatch(`${event.title} ${event.description}`,/Abandons|officially announced the cancellation|total breakdown/iu);
  assert.deepEqual(event.evidenceIds,["js72vx1xywk5s8e034kbkfxwts843xnk","js72mzxtnbrnzzpbgjd2ttvv59845xyg"]);
  assert.match(article.summary,/On April 2/u);
  assert.match(article.summary,/did not itself complete the legal withdrawal process/u);
});
