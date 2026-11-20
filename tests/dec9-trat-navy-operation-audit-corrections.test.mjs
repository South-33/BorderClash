import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse)}
const eventId="ks7ba14rzj523ynks48xtmn88n813t4b"; const articleId="js70jr4gs67nz6g4wt2p6jabk57xemze";
test("Dec 9 Trat operation remains a Thai Navy claim, not a completed expulsion",()=>{
 const event=readJsonl("data/timeline/2025-12.jsonl").find(r=>r.id===eventId); assert.ok(event);
 assert.equal(event.date,"2025-12-09"); assert.equal(event.timeOfDay,"");
 assert.match(event.title,/^Thai Navy Says It Launched Operations/u);
 assert.match(event.description,/what it described as Thai territory/u);
 assert.match(event.description,/did not say the operation had succeeded/u);
 assert.match(event.description,/denied firing back for two days/u);
 assert.doesNotMatch(event.title,/^Thai Navy Expels/u); assert.deepEqual(event.evidenceIds,[articleId]);
});
test("CNA evidence summary and media environment match the captured article",()=>{
 const article=readJsonl("data/news/2025-12.jsonl").find(r=>r.id===articleId); assert.ok(article);
 assert.equal(article.mediaEnvironment,"international");
 assert.match(article.summary,/Thai Navy said/u); assert.match(article.summary,/operations were launched to expel/u);
 assert.match(article.summary,/without further details or confirmation that the operation succeeded/u);
 assert.doesNotMatch(article.summary,/Navy expelled Cambodian forces/u);
});
