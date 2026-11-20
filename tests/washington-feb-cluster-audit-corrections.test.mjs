import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}

test("Washington cluster keeps one Feb 17 Reuters interview and a separate Feb 19 Landau meeting",()=>{
  const timeline=readJsonl("data/timeline/2026-02.jsonl");
  const interview=timeline.find((row)=>row.id==="ks7bxt0jv35sxsfppy552txnth81nc11");
  const landau=timeline.find((row)=>row.id==="ks752mankm88zf6g8qecshp87s81hk59");
  assert.ok(interview); assert.ok(landau);
  assert.equal(interview.date,"2026-02-17");
  assert.equal(landau.date,"2026-02-19");
  assert.equal(landau.timeOfDay,undefined);
  assert.match(landau.title,/Deputy Secretary Landau/u);
  assert.match(landau.description,/U.S. State Department said they discussed the Cambodia-Thailand border situation/u);
  assert.match(landau.description,/support lasting peace along the Cambodia-Thailand border/u);
  assert.doesNotMatch(`${landau.title} ${landau.description}`,/told Reuters|occupying territory deep|container blockades/iu);
  assert.deepEqual(landau.evidenceIds,["k977p1ykypqw8m1famqvjvbj0181ha35","jn7ar9xkhc6w31pqb6sq7maptx81j1a6"]);
  assert.equal(timeline.some((row)=>row.id==="ks79r73mw88wz12gtd818kf6x181csqg"),false);
  assert.equal(timeline.some((row)=>row.id==="ks7bd8gq91p67xkn39barfawnx81fa5k"),false);
});

test("Cambodian Landau-meeting source is explicitly anchored to Feb 19",()=>{
  const article=readJsonl("data/news/2026-02.jsonl").find((row)=>row.id==="jn7ar9xkhc6w31pqb6sq7maptx81j1a6");
  assert.ok(article);
  assert.match(article.summary,/On February 19 in Washington/u);
  assert.match(article.summary,/lasting peace along the Cambodia-Thailand border/u);
});
