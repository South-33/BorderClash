import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=(p)=>readFileSync(p,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const survivor="ks78xa3pdr4f2dzghqtwz73g9985py7q";
const merged=["ks7bat2cqqfgc8201d3xv95mz985ezr9","ks75x5z2v8th4j610h7q0pm67d85ewnq","ks78xphegawes5hayye7hzzf0985c2d7"];
test("April 23 RBC duplicates consolidate under one stable ID at captured 11:00",()=>{
 const rows=read("data/timeline/2026-04.jsonl"); const row=rows.find(x=>x.id===survivor);
 assert.ok(row); assert.equal(row.date,"2026-04-23"); assert.equal(row.timeOfDay,"11:00");
 for(const id of merged) assert.equal(rows.some(x=>x.id===id),false);
});
test("survivor keeps only source-supported meeting scope",()=>{
 const row=read("data/timeline/2026-04.jsonl").find(x=>x.id===survivor);
 assert.match(row.description,/December 27, 2025 GBC Joint Statement/u);
 assert.match(row.description,/operational coordination/u);
 assert.match(row.description,/local-level problem solving/u);
 assert.match(row.description,/does not describe a separate forest-fire prevention/u);
 assert.deepEqual(row.evidenceIds,["59e64bc06b05bd4cb2c14d5a488d623b"]);
});
test("official and DAP articles share one Cambodian ministry provenance",()=>{
 const rows=read("data/news/2026-04.jsonl");
 const a=rows.find(x=>x.id==="59e64bc06b05bd4cb2c14d5a488d623b");
 const b=rows.find(x=>x.id==="jn75pxfy17s5sfwwgpzt3ydan185eek5");
 assert.equal(a.provenanceId,b.provenanceId);
});
