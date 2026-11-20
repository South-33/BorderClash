import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
function readJsonl(p){return readFileSync(p,'utf8').trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
const eventId='ks75w0n5qsmhaskawvzbey8k5x8cat44';
const akp='e59ce773cdabebd1d81b1237393be696';
const speech='819a126d1f750aeae1523f527df9c4e4';
const provenance='cambodia-mfa-pursat-bunkers-grid-protest-2026-08-10';
test('Aug 10 protest is date-only and separates underlying Aug 6 and Aug 7 activity',()=>{const e=readJsonl('data/timeline/2026-08.jsonl').find(r=>r.id===eventId);assert.ok(e);assert.equal(e.date,'2026-08-10');assert.equal(e.timeOfDay,undefined);assert.deepEqual(e.evidenceIds,[akp,speech]);for(const v of ['August 10','August 6','August 7'])assert.match(e.description,new RegExp(v,'u'));});
test('sovereignty and legal conclusions remain attributed to Cambodia',()=>{const e=readJsonl('data/timeline/2026-08.jsonl').find(r=>r.id===eventId);assert.match(e.description,/Cambodia characterized/u);assert.match(e.description,/official allegations/u);assert.match(e.description,/do not independently resolve/u);assert.doesNotMatch(e.title,/Thai Bunkers in Pursat/u);});
test('Thai and Khmer preserve the protest date and underlying activity dates',()=>{const e=readJsonl('data/timeline/2026-08.jsonl').find(r=>r.id===eventId);for(const v of ['10','6','7','2000','27','2025']){assert.ok(e.descriptionTh.includes(v));assert.ok(e.descriptionKh.includes(v));}});
test('usable evidence shares the Cambodian MFA provenance chain',()=>{const rows=readJsonl('data/news/2026-08.jsonl');for(const id of [akp,speech]){const a=rows.find(r=>r.id===id);assert.ok(a);assert.equal(a.provenanceId,provenance);}const old=rows.find(r=>r.id==='jn71vbyf8z48kva6z24a6ets758cakm6');assert.equal(old?.provenanceId,provenance);});
