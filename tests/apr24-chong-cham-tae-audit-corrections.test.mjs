import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const id="ks726v9h7kzxnbnjdbawr35xy585h3yx", evidenceId="c09d77f397723798810527ea6a66dcda";
const rows=()=>readFileSync("data/timeline/2026-04.jsonl","utf8").split(String.fromCharCode(10)).map(x=>x.trim()).filter(Boolean).map(JSON.parse);
test("Chong Cham Tae clip event uses April 24 and removes unsupported 09:00",()=>{const e=rows().find(x=>x.id===id);assert.ok(e);assert.equal(e.date,"2026-04-24");assert.equal(e.timeOfDay,undefined);assert.deepEqual(e.evidenceIds,[evidenceId]);});
test("Chong Cham Tae movement and boundary interpretation remain attributed",()=>{const e=rows().find(x=>x.id===id);assert.match(e.description,/Naewna reported/u);assert.match(e.description,/believed to have been recorded on April 24/u);assert.match(e.description,/not independently established/u);assert.match(e.description,/no exact event time/u);});
