import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
function readJsonl(p){return readFileSync(p,'utf8').trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
const eventId='ks7etjq5hd8hx37bwpn9eae0d18bbxc8';
const evidenceId='7389cfa85ee8a99889abfd3742012dc1';
test('Jul 23 Rubio-Prak meeting removes unsupported 14:00 time',()=>{const e=readJsonl('data/timeline/2026-07.jsonl').find(r=>r.id===eventId);assert.ok(e);assert.equal(e.date,'2026-07-23');assert.equal(e.timeOfDay,undefined);assert.deepEqual(e.evidenceIds,[evidenceId]);assert.match(e.title,/Rubio and Prak Sokhonn/u);});
test('meeting copy stays within the captured State Department readout',()=>{const e=readJsonl('data/timeline/2026-07.jsonl').find(r=>r.id===eventId);assert.match(e.description,/Manila/u);assert.match(e.description,/Kuala Lumpur Peace Accords/u);assert.match(e.description,/scam centers/u);assert.match(e.description,/does not provide an exact meeting time/u);assert.doesNotMatch(e.description,/border stability|international law/iu);});
test('Thai and Khmer preserve date, actors, Manila and peace-accord framing',()=>{const e=readJsonl('data/timeline/2026-07.jsonl').find(r=>r.id===eventId);for(const v of ['23','Marco Rubio'])assert.ok(e.descriptionKh.includes(v));for(const v of ['23','มาร์โก รูบิโอ'])assert.ok(e.descriptionTh.includes(v));assert.match(e.descriptionTh,/มะนิลา/u);assert.match(e.descriptionKh,/ម៉ានីល/u);});
test('timeline cites captured State Department readout copy rather than Fresh News shell',()=>{const rows=readJsonl('data/news/2026-07.jsonl');const a=rows.find(r=>r.id===evidenceId);assert.ok(a);assert.equal(a.source,'U.S. Department of State via Mirage News');assert.equal(a.provenanceId,'us-state-rubio-prak-manila-2026-07-23');assert.equal(a.credibility,90);});
