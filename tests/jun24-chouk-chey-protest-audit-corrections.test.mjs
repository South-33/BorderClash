import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const id="ks7fdczqvfxg05f8p9f7bw9nd589jq33";
const evidenceIds=["b6580a7179987f903bc89ebd4f36df05","jn7187qa7d89vhprtf8fsmdsvx89hda6"];
const rows=p=>readFileSync(p,"utf8").split(String.fromCharCode(10)).map(x=>x.trim()).filter(Boolean).map(JSON.parse);
test("June 24 Chouk Chey protest uses the supported date and no invented exact time",()=>{
 const e=rows("data/timeline/2026-06.jsonl").find(x=>x.id===id); assert.ok(e);
 assert.equal(e.date,"2026-06-24"); assert.equal(e.timeOfDay,undefined); assert.deepEqual(e.evidenceIds,evidenceIds);
 assert.match(e.description,/between June 18 and 22/u); assert.match(e.description,/no exact event time/u);
});
test("Chouk Chey territorial and legal claims remain attributed to Cambodia",()=>{
 const e=rows("data/timeline/2026-06.jsonl").find(x=>x.id===id);
 assert.match(e.description,/Cambodia alleged/u); assert.match(e.description,/Cambodia's stated position/u);
 for(const value of [e.descriptionTh,e.descriptionKh]) { assert.ok(value.includes("2000")); assert.ok(value.includes("46")); assert.ok(value.includes("47")); }
});
test("AKP and Khmer Times are marked as one press-release provenance chain",()=>{
 const news=rows("data/news/2026-06.jsonl").filter(x=>evidenceIds.includes(x.id));
 assert.equal(news.length,2); assert.ok(news.every(x=>x.provenanceId==="cambodia-mfa-chouk-chey-protest-2026-06-24"));
});
