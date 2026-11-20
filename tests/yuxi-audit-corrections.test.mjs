import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Fuxian meeting record keeps the meeting outcome separate from the 20m-yuan reconstruction offer",()=>{
  const event=readJsonl("data/timeline/2025-12.jsonl").find((row)=>row.id==="ks7a26tphjnezhssaw3kyjzjmh8120g2");
  assert.ok(event);
  assert.equal(event.date,"2025-12-29");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.description,/December 28-29/u);
  assert.match(event.description,/Joint Coordinating Task Force/u);
  assert.match(event.description,/ASEAN Observer Team/u);
  assert.doesNotMatch(`${event.title} ${event.description}`,/20 million|20m|Cambodian displaced persons/iu);
  assert.deepEqual(event.evidenceIds,[
    "k97b11b8tsap8yq5e8tcbr0hy97y7wr9",
    "k97exgw11ddapqbqfgv8brgd757y73wg",
    "js7cy5tmkxzj495fbfw06msjrs7y81cm",
  ]);
});
