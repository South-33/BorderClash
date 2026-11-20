import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse)}
const eventId="ks72myc925hgkwdxm7e6p53jms813e6f"; const articleId="jn7cy16t5k9kwk9yxxjvwfgh4s7yr6pz";
test("CHRC UN housing complaint uses its Jan 5 filing date without invented exact time or counts",()=>{
 const event=readJsonl("data/timeline/2026-01.jsonl").find(r=>r.id===eventId); assert.ok(event);
 assert.equal(event.date,"2026-01-05"); assert.equal(event.timeOfDay,"");
 assert.match(event.title,/Cambodian Human Rights Committee Files Property-Rights Complaint/u);
 assert.match(event.description,/Office of the High Commissioner for Human Rights/u);
 assert.match(event.description,/Special Rapporteur on the right to adequate housing/u);
 assert.match(event.description,/Banteay Meanchey, Preah Vihear, Oddar Meanchey and Pursat/u);
 assert.doesNotMatch(event.description,/over 400 houses were demolished/u);
 assert.doesNotMatch(event.description,/demands the immediate withdrawal/u);
 assert.deepEqual(event.evidenceIds,[articleId]);
});
test("DAP News summary stays within the captured CHRC statement",()=>{
 const article=readJsonl("data/news/2026-01.jsonl").find(r=>r.id===articleId); assert.ok(article);
 assert.match(article.summary,/on January 5, 2026/u); assert.match(article.summary,/OHCHR/u);
 assert.match(article.summary,/does not state that more than 400 houses/u);
 assert.match(article.summary,/does not record demands for troop withdrawal or compensation/u);
});
