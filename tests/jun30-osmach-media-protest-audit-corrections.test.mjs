import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const id="ks7b83h9912ysp3xymcjcss6q189m25f";
const rows=()=>readFileSync("data/timeline/2026-06.jsonl","utf8").split(String.fromCharCode(10)).map(x=>x.trim()).filter(Boolean).map(JSON.parse);
test("O'Smach media protest is dated to the captured June 30 report and has no invented time",()=>{const e=rows().find(x=>x.id===id);assert.ok(e);assert.equal(e.date,"2026-06-30");assert.equal(e.timeOfDay,undefined);assert.deepEqual(e.evidenceIds,["jn767sn3gk2akwvs6xmz2dbvsx89m9qv"]);});
test("Cambodian sovereignty and legal conclusions remain attributed",()=>{const e=rows().find(x=>x.id===id);assert.match(e.description,/Cambodia's stated position/u);assert.match(e.description,/Ministry of Information protested/u);assert.match(e.description,/no exact event time/u);});
