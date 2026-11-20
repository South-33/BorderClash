import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const id="ks7c53y7vpt5dfpe023f83mb1584ycmg";
test("unsupported Apr 14 border-activist arrest row is absent",()=>{
  const rows=readFileSync("data/timeline/2026-04.jsonl","utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
  assert.equal(rows.some((r)=>r.id===id),false);
});
