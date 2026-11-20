import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const id="ks747wf5pqyxtbnsn86rh8nm9n813fk5", evidence="js7893qg5ya6vyhkmr01yewge17zf29k";
const row=()=>readFileSync("data/timeline/2026-01.jsonl","utf8").trim().split(/\r?\n/u).map(JSON.parse).find(r=>r.id===id);
test("Jan 15 displacement row uses the captured contemporaneous HRF report",()=>{const e=row();assert.ok(e);assert.equal(e.date,"2026-01-15");assert.equal(e.timeOfDay,undefined);assert.deepEqual(e.evidenceIds,[evidence]);assert.match(e.description,/141,850/u);assert.match(e.description,/102 displacement sites/u);});
test("Jan 15 displacement row preserves the report's exact education figures",()=>{const e=row();assert.match(e.description,/69 schools/u);assert.match(e.description,/12,601 students/u);assert.match(e.description,/no exact event time/u);});
