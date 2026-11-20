import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=(p)=>readFileSync(p,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const id="ks7bfvm0pqgwk2pa27yn0krc11813sk1";
test("Dec 28 trade row removes unsupported 10:00 and war-economy framing",()=>{const e=read("data/timeline/2025-12.jsonl").find(x=>x.id===id);assert.ok(e);assert.equal(e.timeOfDay,undefined);assert.equal(e.category,"economic");assert.doesNotMatch(e.title,/War Economy/u);});
test("row preserves the source-supported customs figures",()=>{const e=read("data/timeline/2025-12.jsonl").find(x=>x.id===id);assert.match(e.description,/34.5%/u);assert.match(e.description,/US\$1,770 million/u);assert.match(e.description,/US\$1,250 million/u);assert.match(e.description,/about 7%/u);assert.match(e.description,/Naewna, citing Kiripost/u);});
test("Thai and Khmer copies preserve the key trade figures",()=>{const e=read("data/timeline/2025-12.jsonl").find(x=>x.id===id);for(const v of [e.descriptionTh,e.descriptionKh]){for(const n of ["34.5%","1,770","1,250","7%"]){assert.ok(v.includes(n));}assert.ok(!v.includes("10:00"));}});
