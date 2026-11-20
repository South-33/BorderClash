import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks71ahtmefjkka8twwz68687fs812y7b";
const evidenceId = "js7ecv8ryk40h35p3nd9jrnapd7ytr7h";
const rows = () => readFileSync("data/timeline/2026-01.jsonl","utf8").trim().split(/\r?\n/u).map(JSON.parse);

test("Jan 5 education row removes unsupported exact time and sweeping collapse framing", () => {
  const e = rows().find((r)=>r.id===id);
  assert.ok(e);
  assert.equal(e.date,"2026-01-05");
  assert.equal(e.timeOfDay, undefined);
  assert.deepEqual(e.evidenceIds,[evidenceId]);
  assert.doesNotMatch(e.title,/Collapse/u);
  assert.doesNotMatch(e.description,/effectively paralyzed|directly targeted/u);
});

test("Jan 5 education row preserves source-supported closure and baseline figures", () => {
  const e = rows().find((r)=>r.id===id);
  for (const value of ["321 schools","61 affected schools","212 schools","62 of 66","1,311 schools","15,034 teachers","322,000 students","as of December 25"]) {
    assert.ok(e.description.includes(value), value);
  }
  for (const v of [e.descriptionTh,e.descriptionKh]) {
    assert.ok(v.includes("1,311"));
    assert.ok(v.includes("322,000"));
  }
});
