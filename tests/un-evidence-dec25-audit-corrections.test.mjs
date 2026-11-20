import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Dec 25 MFA evidence row distinguishes compiled complaints from unrelated article strands",()=>{
  const event=readJsonl("data/timeline/2025-12.jsonl").find((row)=>row.id==="ks77nf32tcy2hxpqaaftksd3p5813f2w");
  const article=readJsonl("data/news/2025-12.jsonl").find((row)=>row.id==="js7bak7hc8hyxsrx34ed5rjyp97xyx3w");
  assert.ok(event); assert.ok(article);
  assert.equal(event.date,"2025-12-25");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.description,/compiled evidence from the border clashes/u);
  assert.match(event.description,/Ottawa Convention states parties and to the UN Secretary-General/u);
  assert.match(event.description,/remain Thailand's account/u);
  assert.doesNotMatch(event.description,/to counter Cambodian narratives/iu);
  assert.match(article.summary,/separately covered GBC talks and military responses/u);
});
