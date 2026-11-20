import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const id="ks750yspax0zpeeetxq0wcyqv18127ed";
const row=()=>readFileSync("data/timeline/2026-01.jsonl","utf8").trim().split(String.fromCharCode(10)).map(JSON.parse).find(r=>r.id===id);
test("Jan 10 AOT visit is grounded in captured Khmer Times reporting",()=>{
  const r=row();
  assert.equal(r.date,"2026-01-10");
  assert.equal(r.timeOfDay,undefined);
  assert.deepEqual(r.evidenceIds,["js7873n24zy1f0vbfz63nsmv597z2bx0"]);
  assert.match(r.description,/Om Ratay/u);
  assert.match(r.description,/more than 1,000/u);
  assert.match(r.description,/Cambodian local-authority claims/u);
});
test("Jan 10 AOT row removes unsupported exact time and second-inspection framing",()=>{
  const r=row();
  assert.doesNotMatch(r.title,/Second/u);
  assert.match(r.description,/no exact 10:00 event time/u);
});
