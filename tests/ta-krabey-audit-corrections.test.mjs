import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Ta Krabey destruction claim keeps Dec 10 occurrence date and Dec 11 statement distinct",()=>{
  const event=readJsonl("data/timeline/2025-12.jsonl").find((row)=>row.id==="ks745rk020by76m06b4y60wgdx813ndz");
  const article=readJsonl("data/news/2025-12.jsonl").find((row)=>row.id==="jn71ea1ye1pjkxd5w881mwggbh7xe471");
  assert.ok(event); assert.ok(article);
  assert.equal(event.date,"2025-12-10");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.title,/Culture Ministry Says/u);
  assert.match(event.description,/renewed shelling on December 10/u);
  assert.match(event.description,/issued the statement on December 11/u);
  assert.doesNotMatch(event.description,/following two days of heavy shelling/iu);
  assert.match(article.summary,/issued a statement on December 11/u);
  assert.match(article.summary,/renewed shelling on December 10/u);
  assert.doesNotMatch(article.summary,/December 10 and 11/iu);
});
