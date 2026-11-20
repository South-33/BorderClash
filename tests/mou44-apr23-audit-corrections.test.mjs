import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("April 23 MOU 44 record distinguishes NSC approval from final legal withdrawal",()=>{
  const event=readJsonl("data/timeline/2026-04.jsonl").find((row)=>row.id==="ks76kr499qfbggq173g3z09rts85gmk7");
  const thaiPbs=readJsonl("data/news/2026-04.jsonl").find((row)=>row.id==="js72j21xsjn1mzq9ta4d19pjsd85jqxf");
  assert.ok(event); assert.ok(thaiPbs);
  assert.equal(event.date,"2026-04-23");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.title,/Backs Withdrawal/u);
  assert.match(event.description,/Cabinet proposal would follow/u);
  assert.match(event.description,/rather than the final legal withdrawal/u);
  assert.doesNotMatch(`${event.title} ${event.description}`,/Formally Scraps|officially resolved to terminate/iu);
  assert.deepEqual(event.evidenceIds,["k97ba16tpdgxcbna73gj84xs4985g43n","js7a105jdddpcfh1hyxv6mrh4s85gw5m","js72j21xsjn1mzq9ta4d19pjsd85jqxf"]);
  assert.match(thaiPbs.summary,/On April 23/u);
  assert.match(thaiPbs.summary,/submit the matter to Cabinet/u);
});
