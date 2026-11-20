import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
const eventId="ks75m2b2zs9b6cvwbv80d3y2m9813ty4", ev="994c96edf3bee08a13f5edff72cd3e03", old="jn75cz1ezbt7j566dqrvmbm5vd7xdvsx", prov="cambodia-mfa-f16-condemnation-2025-12-15";
test("Dec 15 Cambodian MFA row removes unsupported 14:00 and uses captured corroboration",()=>{const e=readJsonl("data/timeline/2025-12.jsonl").find(r=>r.id===eventId);assert.ok(e);assert.equal(e.date,"2025-12-15");assert.equal(e.timeOfDay,undefined);assert.deepEqual(e.evidenceIds,[ev]);assert.match(e.title,/Cambodian MFA Condemns Thai F-16 Strikes/u);});
test("deep-incursion and damage claims stay attributed to Cambodia",()=>{const e=readJsonl("data/timeline/2025-12.jsonl").find(r=>r.id===eventId);for(const v of ["80–90","400,000","F-16"]){assert.ok(e.description.includes(v),v);}assert.match(e.description,/Cambodian government allegations and legal characterizations/u);assert.match(e.description,/does not independently establish/u);});
test("Thai and Khmer preserve date, distance, displacement figure and uncertainty",()=>{const e=readJsonl("data/timeline/2025-12.jsonl").find(r=>r.id===eventId);for(const v of ["15","80–90","400,000","F-16"]){assert.ok(e.descriptionTh.includes(v),`Thai ${v}`);assert.ok(e.descriptionKh.includes(v),`Khmer ${v}`);}});
test("same Cambodian MFA statement chain shares provenance",()=>{const rows=readJsonl("data/news/2025-12.jsonl");assert.equal(rows.find(r=>r.id===ev)?.provenanceId,prov);assert.equal(rows.find(r=>r.id===old)?.provenanceId,prov);});
