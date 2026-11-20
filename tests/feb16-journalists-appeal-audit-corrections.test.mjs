import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7fjeenpqjs97b5t3jq7szj7d81njft";
const evidenceId = "87961d8836c70f6d437278ba94a4bf5b";
const row = () => readFileSync("data/timeline/2026-02.jsonl","utf8")
  .trim().split(/\r?\n/u).map(JSON.parse).find((record)=>record.id===id);

test("Feb 16 journalist appeal uses captured CPJ reporting",()=>{
  const event=row();
  assert.ok(event);
  assert.equal(event.date,"2026-02-16");
  assert.equal(event.timeOfDay,undefined);
  assert.deepEqual(event.evidenceIds,[evidenceId]);
  assert.match(event.description,/Monday, February 16/u);
  assert.match(event.description,/14-year treason sentences/u);
});

test("journalist appeal avoids unsupported conviction causation",()=>{
  const event=row();
  assert.match(event.description,/not immediately clear which reports prompted/u);
  assert.match(event.description,/no exact appeal time/u);
  assert.doesNotMatch(event.description,/convicted for posting Facebook photos/u);
});
