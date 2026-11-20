import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
function readJsonl(p){return readFileSync(p,'utf8').trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
const eventId='ks71am5rhh988k8em071n22hmn812v84';
const hrfId='ks7c5gvvpw28qv1zs90wt1thnd8136bj';
const akpId='jn79ks45aeycm5v1wwbvxk3xhd7yhza2';
const badId='jn7d91cc52hygsxgvf4cx0d51n7ymvs1';
const prov='cambodia-interior-jan1-return-snapshot';
test('Jan 1 Interior Ministry snapshot uses the directly supported 18:00 time',()=>{const e=readJsonl('data/timeline/2026-01.jsonl').find(r=>r.id===eventId);assert.ok(e);assert.equal(e.date,'2026-01-01');assert.equal(e.timeOfDay,'18:00');assert.deepEqual(e.evidenceIds,[akpId]);assert.match(e.title,/103,177/u);});
test('return and remaining counts match the captured AKP report',()=>{const e=readJsonl('data/timeline/2026-01.jsonl').find(r=>r.id===eventId);for(const v of ['103,177','409,186','214,525','131,413'])assert.ok(e.description.includes(v),v);assert.match(e.description,/December 27 ceasefire/u);});
test('separate HRF NCDM Jan 1 snapshot remains present rather than being falsely reconciled',()=>{const rows=readJsonl('data/timeline/2026-01.jsonl');assert.ok(rows.some(r=>r.id===hrfId));const e=rows.find(r=>r.id===eventId);assert.match(e.description,/separate from the broader HRF\/NCDM/u);});
test('Thai and Khmer preserve time and key counts',()=>{const e=readJsonl('data/timeline/2026-01.jsonl').find(r=>r.id===eventId);for(const v of ['18:00','103,177','409,186','214,525','131,413']){assert.ok(e.descriptionTh.includes(v),`Thai ${v}`);assert.ok(e.descriptionKh.includes(v),`Khmer ${v}`);}});
test('Interior Ministry reports share provenance while only captured AKP is cited',()=>{const rows=readJsonl('data/news/2026-01.jsonl');assert.equal(rows.find(r=>r.id===akpId)?.provenanceId,prov);assert.equal(rows.find(r=>r.id===badId)?.provenanceId,prov);});
