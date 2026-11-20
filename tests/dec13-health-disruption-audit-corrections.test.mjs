import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse)}
const eventId="ks780cd441c47sgs8wcfb0y2tn813jg4";
const articleId="jn7dfpqfzymcrzcjw79y9npvz97x6tn9";
test("Dec 13 health disruption is date-only and bounded to HRF findings",()=>{
 const event=readJsonl("data/timeline/2025-12.jsonl").find(r=>r.id===eventId);
 assert.ok(event); assert.equal(event.date,"2025-12-13"); assert.equal(event.timeOfDay,"");
 assert.match(event.title,/^HRF Reports 51 Health Facilities Closed/u);
 assert.match(event.description,/331,158/u); assert.match(event.description,/51 healthcare facilities across six provinces/u);
 assert.match(event.description,/direct shelling or insecurity/u); assert.match(event.description,/does not attribute every closure to Thai forces/u);
 assert.doesNotMatch(event.description,/COVID-19/u); assert.doesNotMatch(event.title,/Collapses/u);
 assert.deepEqual(event.evidenceIds,[articleId]);
});
test("Cambodianess summary preserves HRF attribution and closure cause",()=>{
 const article=readJsonl("data/news/2025-12.jsonl").find(r=>r.id===articleId);
 assert.ok(article); assert.match(article.summary,/Situation Report 11/u); assert.match(article.summary,/331,158/u);
 assert.match(article.summary,/51 healthcare facilities/u); assert.match(article.summary,/direct shelling or insecurity/u);
});
