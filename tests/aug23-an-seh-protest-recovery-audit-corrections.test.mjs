import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=(p)=>readFileSync(p,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const id="ks74tpbz387p89zc1vxe04zg5s8dbvrb", evidence="b04edeab936e2cd835177a69f6d9a882";
test("Aug 23 visit row uses captured Cambodia protest without unsupported exact time",()=>{const r=read("data/timeline/2026-08.jsonl").find(x=>x.id===id);assert.ok(r);assert.equal(r.date,"2026-08-23");assert.equal(r.timeOfDay,undefined);assert.deepEqual(r.evidenceIds,[evidence]);assert.match(r.title,/Cambodia Protests Thai PM/i);assert.match(r.description,/August 26/u);assert.match(r.description,/August 23 visit/u);assert.match(r.description,/Cambodia calls An Seh/u);assert.match(r.description,/does not independently establish sovereignty/u);assert.doesNotMatch(r.description,/14:00|security briefing|delivered supplies|morale support/u);});
test("Thai and Khmer copies preserve attribution and time uncertainty",()=>{const r=read("data/timeline/2026-08.jsonl").find(x=>x.id===id);for(const v of [r.descriptionTh,r.descriptionKh]){assert.ok(v.length>250);assert.ok(v.includes("23"));assert.ok(v.includes("26"));assert.ok(!v.includes("14:00"));}});
test("AKP capture is the sole cited publisher evidence",()=>{const a=read("data/news/2026-08.jsonl").find(x=>x.id===evidence);assert.ok(a);assert.equal(a.source,"AKP");assert.match(a.summary,/August 23 visit/u);assert.match(a.summary,/not sovereignty|territorial position/i);});
