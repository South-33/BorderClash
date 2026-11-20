import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
const targetId="ks76nr876600f1cksqjp7fc4t181x8me"; const dupId="ks74f9v8z53fd6dh053hret1zn81t2v5";
test("Feb 24 ammo-depot duplicate is merged into one date-only event",()=>{const rows=readJsonl("data/timeline/2026-02.jsonl");const e=rows.find(r=>r.id===targetId);assert.ok(e);assert.equal(e.date,"2026-02-24");assert.equal(e.timeOfDay,undefined);assert.ok(!rows.some(r=>r.id===dupId));assert.deepEqual(e.evidenceIds,["jn77abebsahchyvnyzhj2q4ymx81xznw","k97ehde0f1d48jgae2xve3zkd981ttgg"]);});
test("conflicting approximate start times are preserved without false precision",()=>{const e=readJsonl("data/timeline/2026-02.jsonl").find(r=>r.id===targetId);assert.match(e.description,/19:30/u);assert.match(e.description,/20:00/u);assert.match(e.description,/date-only/u);});
test("injury evacuation munitions and cause uncertainty stay attributed",()=>{const e=readJsonl("data/timeline/2026-02.jsonl").find(r=>r.id===targetId);for(const v of ["50 km","300 residents","mortar","RPG"]){assert.ok(e.description.includes(v),v);}assert.match(e.description,/cause was still under investigation/u);assert.match(e.description,/sabotage had not been ruled out/u);assert.match(e.description,/attributed to Thai officials/u);});
test("Thai and Khmer preserve time discrepancy and core counts",()=>{const e=readJsonl("data/timeline/2026-02.jsonl").find(r=>r.id===targetId);for(const v of ["24","50","19:30","20:00","300","RPG"]){assert.ok(e.descriptionTh.includes(v),`Thai ${v}`);assert.ok(e.descriptionKh.includes(v),`Khmer ${v}`);}});
