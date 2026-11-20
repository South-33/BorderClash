import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const id="ks7czz087ph08ap98c9nh052dx812ddk";
const row=()=>readFileSync("data/timeline/2026-02.jsonl","utf8").trim().split(/\r?\n/u).map(JSON.parse).find(r=>r.id===id);
test("Feb 7 Thmar Da row is grounded in captured Khmer Times reporting",()=>{
 const r=row(); assert.equal(r.date,"2026-02-07"); assert.equal(r.timeOfDay,"05:40"); assert.deepEqual(r.evidenceIds,["jn7csnq3kppcd18042ga83c5zh80pja5"]);
 assert.match(r.description,/approximately 05:40/u); assert.match(r.description,/seven shipping containers/u); assert.match(r.description,/Cambodia's position/u);
 assert.doesNotMatch(r.description,/four affected locations|80 displaced families|14:00/u);
});
