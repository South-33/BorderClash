import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);}
const legalId="ks70wvhjwx2692yn3p3yzv7cm5813xmd";
const warningId="ks7dj627yvh1c9jkcd67xb63wd812tvn";
const siamId="6248ff9658b1e1d51f5c483c9f682e9a";
const israId="76c63a428181af93cba11be4ed77ae5e";
test("Jan 4 legal briefing uses captured 11:00 support",()=>{const e=readJsonl("data/timeline/2026-01.jsonl").find(r=>r.id===legalId);assert.ok(e);assert.equal(e.date,"2026-01-04");assert.equal(e.timeOfDay,"11:00");assert.deepEqual(e.evidenceIds,[siamId]);assert.match(e.description,/Thai official allegations/u);assert.match(e.description,/does not independently establish/u);});
test("communications warning is a separate Jan 4 date-only event",()=>{const e=readJsonl("data/timeline/2026-01.jsonl").find(r=>r.id===warningId);assert.ok(e);assert.equal(e.date,"2026-01-04");assert.equal(e.timeOfDay,undefined);assert.deepEqual(e.evidenceIds,[israId]);assert.match(e.description,/clauses 14 and 16/u);assert.match(e.description,/not an independent finding that Cambodia violated the ceasefire/u);assert.doesNotMatch(e.description,/PR offensive|09:00|annexation/iu);});
test("Thai and Khmer preserve core dates, numbers, and attribution",()=>{const rows=readJsonl("data/timeline/2026-01.jsonl");const a=rows.find(r=>r.id===legalId);const b=rows.find(r=>r.id===warningId);for(const v of ["11:00","4"]){assert.ok(a.descriptionTh.includes(v));assert.ok(a.descriptionKh.includes(v));}for(const v of ["4","14","16","27"]){assert.ok(b.descriptionTh.includes(v));assert.ok(b.descriptionKh.includes(v));}});
test("captured evidence exists for both separate Jan 4 statements",()=>{const rows=readJsonl("data/news/2026-01.jsonl");const s=rows.find(r=>r.id===siamId);const i=rows.find(r=>r.id===israId);assert.ok(s);assert.ok(i);assert.match(s.summary,/11:00/u);assert.match(i.summary,/January 4/u);});
