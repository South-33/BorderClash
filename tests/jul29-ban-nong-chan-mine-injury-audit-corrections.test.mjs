import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
function readJsonl(p){return readFileSync(p,'utf8').trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
const event='ks79r1fvtrs2aq9f78v2yq2zg98bj9ng', evidence='064b0d50ca5d02695a7f643665bf8c14';
test('Jul 29 mine injury keeps directly supported about-11:00 time',()=>{const e=readJsonl('data/timeline/2026-07.jsonl').find(r=>r.id===event);assert.ok(e);assert.equal(e.date,'2026-07-29');assert.equal(e.timeOfDay,'11:00');assert.deepEqual(e.evidenceIds,[evidence]);assert.match(e.title,/Critically Injured/u);});
test('injury and mine details are attributed without assigning mine responsibility',()=>{const e=readJsonl('data/timeline/2026-07.jsonl').find(r=>r.id===event);assert.match(e.description,/report carried by The Star said/u);assert.match(e.description,/lost his left leg/u);assert.match(e.description,/right leg and left arm/u);assert.match(e.description,/does not independently establish when or by whom the mine was laid/u);});
test('Thai and Khmer preserve time, date, mine type and attribution',()=>{const e=readJsonl('data/timeline/2026-07.jsonl').find(r=>r.id===event);for(const v of ['11:00','29','PMN']){assert.ok(e.descriptionTh.includes(v),`Thai ${v}`);assert.ok(e.descriptionKh.includes(v),`Khmer ${v}`);}});
test('same Thai operational chain is not counted as independent corroboration',()=>{const rows=readJsonl('data/news/2026-07.jsonl');for(const id of ['js738exkr6vkaj1wxjk3581tpd8bk4ax','js7fd9pb5rp8xm4bxjc6nwwm3s8bjahq',evidence])assert.equal(rows.find(r=>r.id===id)?.provenanceId,'thai-operational-ban-nong-chan-mine-injury-2026-07-29');assert.ok(!rows.some(r=>r.id==='3cd943c74f30893c62927ec1b3903339'));});
