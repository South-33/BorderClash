import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}

test("April fuel crackdown keeps Apr 2 directive and Apr 3 enforcement stage distinct",()=>{
  const timeline=readJsonl("data/timeline/2026-04.jsonl");
  const apr2=timeline.find((row)=>row.id==="ks7dc66b34sem9z2wxyrm2pnx5842ajg");
  const apr3=timeline.find((row)=>row.id==="ks7ep0s56ep3bxxck354z8dh35846s84");
  assert.ok(apr2); assert.ok(apr3);
  assert.equal(apr2.date,"2026-04-02"); assert.equal(apr2.timeOfDay,undefined);
  assert.equal(apr3.date,"2026-04-03"); assert.equal(apr3.timeOfDay,undefined);
  assert.match(apr2.title,/Orders Crackdown/u);
  assert.match(apr2.description,/still verifying the scale and details/u);
  assert.match(apr3.title,/Maritime Surveillance/u);
  assert.match(apr3.description,/March 6 export ban/u);
  assert.match(apr3.description,/96 abnormal voyages/u);
  assert.match(apr3.description,/not the start of a new maritime blockade/u);
  assert.deepEqual(apr3.evidenceIds,["js77pkdzrc88an16bhtjv3kcs184741d","k976ckbrz6qn9sjp2qaqkatwa184766q"]);
  assert.equal(timeline.some((row)=>row.id==="ks7ad4r5cdwawdd0p0rg5p4n4d8473gv"),false);
});

test("fuel source summaries anchor Apr 2, Apr 3 and March 6 roles separately",()=>{
  const news=readJsonl("data/news/2026-04.jsonl");
  const apr2=news.find((row)=>row.id==="jn79w82jgh8sb1g0ps58v9jqks843730");
  const meeting=news.find((row)=>row.id==="js77pkdzrc88an16bhtjv3kcs184741d");
  const bloomberg=news.find((row)=>row.id==="k976ckbrz6qn9sjp2qaqkatwa184766q");
  assert.match(apr2.summary,/On April 2/u);
  assert.match(meeting.summary,/On April 3/u);
  assert.match(bloomberg.summary,/Reporting on April 3/u);
  assert.match(bloomberg.summary,/March 6 fuel-export ban/u);
});
