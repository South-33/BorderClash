import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
const id="ks71e663n23dmn5a2qgp6xdfy5821gqn";
test("Feb 28 reinforcement row removes unsupported exact time and province precision",()=>{const e=readJsonl("data/timeline/2026-02.jsonl").find(r=>r.id===id);assert.ok(e);assert.equal(e.date,"2026-02-28");assert.equal(e.timeOfDay,undefined);assert.doesNotMatch(e.title,/Banteay Meanchey/u);});
test("deployment numbers and replacement-loss theory remain attributed to Thai sources",()=>{const e=readJsonl("data/timeline/2026-02.jsonl").find(r=>r.id===id);for(const v of ["500","four to five","December 2025"]){assert.ok(e.description.includes(v),v);}assert.match(e.description,/Thai-source assessments/u);assert.match(e.description,/not independently verified/u);});
test("Thai and Khmer preserve date, 500 troops, and 4-5 company estimate",()=>{const e=readJsonl("data/timeline/2026-02.jsonl").find(r=>r.id===id);for(const v of ["28","500","4-5"]){assert.ok(e.descriptionTh.includes(v),`Thai ${v}`);assert.ok(e.descriptionKh.includes(v),`Khmer ${v}`);}});
