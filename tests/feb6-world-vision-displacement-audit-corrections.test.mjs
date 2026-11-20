import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
const eventId="ks76eeqd59df1c73knga8xgkdx812ywk";
const evidenceId="k97a5kt43k8zbgtf7xq5c0fxg180ww24";
test("Feb 6 row is explicitly the World Vision report, without an invented exact time",()=>{
 const event=readJsonl("data/timeline/2026-02.jsonl").find(r=>r.id===eventId);
 assert.ok(event); assert.equal(event.date,"2026-02-06"); assert.equal(event.timeOfDay,undefined);
 assert.match(event.title,/World Vision Report Says Nearly 98,000/u);
 assert.match(event.description,/as of early February/u);
 assert.match(event.description,/not an exact observation time/u);
});
test("humanitarian counts match the captured report",()=>{
 const event=readJsonl("data/timeline/2026-02.jsonl").find(r=>r.id===eventId);
 for(const value of ["98,000","85%","640,000","550,000","51,000","31,000","48","22"]) assert.ok(event.description.includes(value),value);
});
test("Thai and Khmer preserve counts and early-February timing uncertainty",()=>{
 const event=readJsonl("data/timeline/2026-02.jsonl").find(r=>r.id===eventId);
 for(const value of ["23","6","98,000","85%","640,000","550,000","51,000","31,000","48","22"]){
  assert.ok(event.descriptionTh.includes(value),`Thai: ${value}`); assert.ok(event.descriptionKh.includes(value),`Khmer: ${value}`);
 }
 assert.match(event.descriptionTh,/ช่วงต้นกุมภาพันธ์/u); assert.match(event.descriptionKh,/ដើមខែកុម្ភៈ/u);
});
test("evidence summary reflects the report date and snapshot language",()=>{
 const article=readJsonl("data/news/2026-02.jsonl").find(r=>r.id===evidenceId);
 assert.ok(article); assert.match(article.summary,/dated February 6/u); assert.match(article.summary,/as of early February/u); assert.match(article.summary,/22 health facilities/u);
});
