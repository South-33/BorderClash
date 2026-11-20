import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
const id="ks75d66qyqes782dtxqgaym85x813r06"; const ev="jn7am6n1t7m2smhjv7b03xswe580dptq";
test("Feb 2 health-facility row removes unsupported exact time",()=>{const e=readJsonl("data/timeline/2026-02.jsonl").find(r=>r.id===id);assert.ok(e);assert.equal(e.date,"2026-02-02");assert.equal(e.timeOfDay,undefined);assert.match(e.title,/About 70 Border Health Facilities/u);});
test("damage figure and responsibility stay attributed to Cambodia's health minister",()=>{const e=readJsonl("data/timeline/2026-02.jsonl").find(r=>r.id===id);for(const v of ["70","provincial hospitals","district referral hospitals","health centres","health posts"]){assert.ok(e.description.includes(v),v);}assert.match(e.description,/he attributed to Thai forces/u);assert.match(e.description,/does not independently verify/u);});
test("UNFPA detail is limited to packages delivered to Preah Vihear provincial health department",()=>{const e=readJsonl("data/timeline/2026-02.jsonl").find(r=>r.id===id);assert.match(e.description,/UNFPA Cambodia/u);assert.match(e.description,/Preah Vihear provincial health department/u);assert.doesNotMatch(e.description,/affected provinces/u);});
test("Thai and Khmer preserve date and about-70 attribution framing",()=>{const e=readJsonl("data/timeline/2026-02.jsonl").find(r=>r.id===id);for(const v of ["2","70","UNFPA"]){assert.ok(e.descriptionTh.includes(v),`Thai ${v}`);assert.ok(e.descriptionKh.includes(v),`Khmer ${v}`);}});
test("evidence summary matches captured publisher text",()=>{const a=readJsonl("data/news/2026-02.jsonl").find(r=>r.id===ev);assert.ok(a);assert.match(a.summary,/about 70 border health facilities/u);assert.match(a.summary,/Preah Vihear provincial health department/u);});
