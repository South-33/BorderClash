import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Feb 17 Hun Manet Reuters interview keeps occupation and displacement claims attributed",()=>{
  const event=readJsonl("data/timeline/2026-02.jsonl").find((row)=>row.id==="ks7bxt0jv35sxsfppy552txnth81nc11");
  const news=readJsonl("data/news/2026-02.jsonl");
  const reuters=news.find((row)=>row.id==="9be161031232031811ec7ca4544c08de");
  const displacement=news.find((row)=>row.id==="27b7f326d1a88742a6d29bc3f7cc02a2");
  const thaiDenial=news.find((row)=>row.id==="k97f4e9efgrevr34w6jzn0bqdx81ev68");
  assert.ok(event); assert.ok(reuters); assert.ok(displacement); assert.ok(thaiDenial);
  assert.equal(event.date,"2026-02-17");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.title,/Alleges Thai Occupation/u);
  assert.match(event.description,/Hun Manet told Reuters/u);
  assert.match(event.description,/Interior Ministry had reported on February 12 that about 80,000 people remained in camps/u);
  assert.match(event.description,/Thailand denied occupying Cambodian territory/u);
  assert.match(event.description,/had not been reinforced/u);
  assert.deepEqual(event.evidenceIds,[
    "9be161031232031811ec7ca4544c08de",
    "27b7f326d1a88742a6d29bc3f7cc02a2",
    "k97f4e9efgrevr34w6jzn0bqdx81ev68",
  ]);
  assert.match(reuters.summary,/February 17 interview/u);
  assert.match(reuters.summary,/Thailand denied occupying Cambodian territory/u);
  assert.match(displacement.summary,/about 80,000 of more than 640,000 displaced people remained in camps/u);
  assert.match(thaiDenial.summary,/rejected accusations made by Hun Manet/u);
});
