import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
test("Dec 22 Cambodian GBC letter is not misdated or flattened into a standalone ceasefire request",()=>{
  const event=readJsonl("data/timeline/2025-12.jsonl").find((row)=>row.id==="ks7by25mjrrjdzrvtmme3avwwh813e59");
  assert.ok(event);
  assert.equal(event.date,"2025-12-22");
  assert.equal(event.timeOfDay,undefined);
  assert.match(event.title,/Dec 22 GBC Letter Proposes Ceasefire Agenda/u);
  assert.match(event.description,/agreeing to the proposed General Border Committee meeting/u);
  assert.match(event.description,/immediate cessation of hostilities/u);
  assert.match(event.description,/characterized it as Cambodia seeking ceasefire negotiations/u);
  assert.match(event.description,/misinterpreted the letter as a standalone formal ceasefire proposal/u);
  assert.deepEqual(event.evidenceIds,["e189555f175f257a9508681081689e64","js71bve66ypt34bjpgae790wns7xwyq7","93093868743ad5c74f023e6b271a175c"]);
});
test("Thai article summaries preserve the letter date and distinguish Thai framing",()=>{
  const news=readJsonl("data/news/2025-12.jsonl");
  const matichon=news.find((row)=>row.id==="js71bve66ypt34bjpgae790wns7xwyq7");
  const prachatai=news.find((row)=>row.id==="js757k8e9hg5f17eesffrhngd57xzs2g");
  assert.match(matichon.summary,/letter dated December 22/u);
  assert.match(matichon.summary,/characterized it as Cambodia expressing a wish/u);
  assert.match(prachatai.summary,/letter dated December 22/u);
  assert.match(prachatai.summary,/Cambodia later disputed that characterization/u);
});
