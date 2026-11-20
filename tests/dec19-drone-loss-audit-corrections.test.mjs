import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const id="ks71mnp7ywdr130egvf541tw1s813nxq";
const rows=()=>readFileSync("data/timeline/2025-12.jsonl","utf8").split(String.fromCharCode(10)).map(x=>x.trim()).filter(Boolean).map(JSON.parse);
test("Dec 19 drone-loss row removes unsupported exact time",()=>{const e=rows().find(x=>x.id===id);assert.ok(e);assert.equal(e.date,"2025-12-19");assert.equal(e.timeOfDay,undefined);assert.deepEqual(e.evidenceIds,["jn7531821c9ntkn3kmtnm1gy3x7xkfns"]);assert.match(e.description,/DP-20/u);});
test("drone-loss circumstances stay bounded to the reported minister acknowledgement",()=>{const e=rows().find(x=>x.id===id);assert.match(e.description,/reported acknowledgement/u);assert.match(e.description,/does not independently establish/u);assert.match(e.description,/no exact event time/u);});
