import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Ban Nong Chan control claim uses First Army Region and the source-supported 09:30 time",()=>{
  const event=readJsonl("data/timeline/2025-12.jsonl").find((row)=>row.id==="ks774pse745wnhqvpctdtcwee181232k");
  const article=readJsonl("data/news/2025-12.jsonl").find((row)=>row.id==="js76ec530s75k6w98j4jtknmcn7y303x");
  assert.ok(event); assert.ok(article);
  assert.equal(event.date,"2025-12-26");
  assert.equal(event.timeOfDay,"09:30");
  assert.match(event.title,/First Army Region/u);
  assert.match(event.description,/Ban Khlong Phaeng, Ban Nong Chan, and Ban Nong Ya Kaew/u);
  assert.match(event.description,/control claim is attributed to the Thai military/u);
  assert.doesNotMatch(event.description,/Second Army Region announced full control|F-16 strikes on weapons depots/iu);
  assert.match(article.summary,/First Army Region announced at 09:30 on December 26/u);
  assert.match(article.summary,/distinct fronts and claims/u);
});
