import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const id="ks7cfb2g0v10w94wfefva1ga9n81fp35";
test("unsupported Feb 18 Chong Sai Taku fire row is absent",()=>{
 const rows=readFileSync("data/timeline/2026-02.jsonl","utf8").split(String.fromCharCode(10)).map(x=>x.trim()).filter(Boolean).map(JSON.parse);
 assert.equal(rows.some(x=>x.id===id),false);
});
