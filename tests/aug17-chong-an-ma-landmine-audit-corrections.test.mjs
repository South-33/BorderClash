import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
function readJsonl(p){return readFileSync(p,'utf8').trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
const eventId='ks73fj8gs2q52kvcmyeq3vz8x98cw4ne';
const evidenceId='15bb5ffc36b80c07343aa6178c13dfff';
const provenance='thai-2nd-army-chong-an-ma-mine-incident-2026-08-17-1030';
test('Aug 17 Chong An Ma mine injury retains directly supported 10:30 precision',()=>{const e=readJsonl('data/timeline/2026-08.jsonl').find(r=>r.id===eventId);assert.ok(e);assert.equal(e.date,'2026-08-17');assert.equal(e.timeOfDay,'10:30');assert.deepEqual(e.evidenceIds,[evidenceId]);assert.match(e.description,/At about 10:30/u);});
test('injury and evacuation stay within captured 2nd Army reporting',()=>{const e=readJsonl('data/timeline/2026-08.jsonl').find(r=>r.id===eventId);for(const v of ['Charnnarong Wongchana','lower right leg','Nam Yuen Hospital','Sunpasitthiprasong Hospital'])assert.match(e.description,new RegExp(v,'u'));assert.match(e.description,/does not establish when or by whom the mine was laid/u);});
test('Thai and Khmer preserve date, time and uncertainty boundary',()=>{const e=readJsonl('data/timeline/2026-08.jsonl').find(r=>r.id===eventId);for(const v of ['10:30','17']){assert.ok(e.descriptionTh.includes(v));assert.ok(e.descriptionKh.includes(v));}assert.match(e.descriptionTh,/ไม่ได้ยืนยัน/u);assert.match(e.descriptionKh,/មិនបញ្ជាក់/u);});
test('timeline uses captured Bangkok Post mirror and shared operational provenance',()=>{const rows=readJsonl('data/news/2026-08.jsonl');const a=rows.find(r=>r.id===evidenceId);assert.ok(a);assert.equal(a.provenanceId,provenance);assert.equal(rows.find(r=>r.id==='js7chw3pdpx685nyee6509n5rn8cwvhg')?.provenanceId,provenance);for(const id of ['ae8e06391f33c2888a9644ea156274bf','8dd33e788fe2a4de797ba6138e956e2f','21a29539d30ecf290914271b0f7eed6f'])assert.equal(rows.some(r=>r.id===id),false);});
