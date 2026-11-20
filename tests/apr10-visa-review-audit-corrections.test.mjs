import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
function readJsonl(p){return readFileSync(p,'utf8').trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
const eventId='ks79gvkcjwdydgdpckgjjjxawh84mkpq';
const evidenceId='cc5de67eccf5fd3c30b5e266884874de';
test('Apr 10 visa review is date-only and covers more than 90 countries',()=>{const e=readJsonl('data/timeline/2026-04.jsonl').find(r=>r.id===eventId);assert.ok(e);assert.equal(e.date,'2026-04-10');assert.equal(e.timeOfDay,undefined);assert.deepEqual(e.evidenceIds,[evidenceId]);assert.match(e.title,/90\+ Countries/u);assert.match(e.description,/more than 90 countries/u);});
test('row records a study, not an enacted Cambodia-specific change',()=>{const e=readJsonl('data/timeline/2026-04.jsonl').find(r=>r.id===eventId);assert.match(e.description,/studying a review/u);assert.match(e.description,/60 days to 30 days/u);assert.match(e.description,/not an enacted change/u);assert.match(e.description,/not specific to Cambodian nationals/u);assert.doesNotMatch(e.title,/Cambodian/u);});
test('unrelated MOU 44 claim is explicitly separated',()=>{const e=readJsonl('data/timeline/2026-04.jsonl').find(r=>r.id===eventId);assert.match(e.description,/does not concern.*MOU 44/u);assert.doesNotMatch(e.title,/MOU/u);});
test('Thai and Khmer preserve scope, durations, date and policy-review uncertainty',()=>{const e=readJsonl('data/timeline/2026-04.jsonl').find(r=>r.id===eventId);for(const v of ['10','90','60','30','44']){assert.ok(e.descriptionTh.includes(v),`Thai ${v}`);assert.ok(e.descriptionKh.includes(v),`Khmer ${v}`);}assert.match(e.descriptionTh,/ศึกษา\/ทบทวน/u);assert.match(e.descriptionKh,/សិក្សា\/ពិនិត្យ/u);});
test('replacement evidence is captured-report metadata for the Apr 10 parliamentary statement',()=>{const a=readJsonl('data/news/2026-04.jsonl').find(r=>r.id===evidenceId);assert.ok(a);assert.equal(a.source,'The Economic Times (citing Nation Thailand)');assert.equal(a.provenanceId,'thai-tourism-visa-review-apr10-2026');assert.match(a.summary,/more than 90 countries/u);assert.match(a.summary,/study\/review/u);});
