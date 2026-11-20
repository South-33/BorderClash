import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id="ks79qcez0tsaerhn3kpgw9bny18123yc";
const evidenceId="3973fc584828598bcca962305ae21434";
const row=()=>readFileSync("data/timeline/2025-12.jsonl","utf8").trim().split(/\r?\n/u).map(JSON.parse).find((r)=>r.id===id);

test("Dec 28 displaced return row is narrowed to AKP's documented Poipet return",()=>{
  const e=row();
  assert.ok(e);
  assert.equal(e.date,"2025-12-28");
  assert.equal(e.timeOfDay,undefined);
  assert.deepEqual(e.evidenceIds,[evidenceId]);
  assert.match(e.title,/Poipet/u);
  assert.match(e.description,/that afternoon/u);
});
test("Dec 28 return row drops unsupported destroyed-village framing and exact time",()=>{
  const e=row();
  assert.match(e.description,/does not support the previous 14:00 time/u);
  assert.match(e.description,/does not support.*destroyed border villages/u);
});
