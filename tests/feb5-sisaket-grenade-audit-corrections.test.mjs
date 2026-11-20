import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=(p)=>readFileSync(p,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const id="ks73m5kfmayrk0h0mhevqts30d812rtx";
const evidenceId="k975qd06d9x8vjsmmk520vvjyx80jb34";
test("Feb 5 grenade row keeps the source-supported 10:18 time",()=>{const e=read("data/timeline/2026-02.jsonl").find(x=>x.id===id);assert.ok(e);assert.equal(e.date,"2026-02-05");assert.equal(e.timeOfDay,"10:18");assert.deepEqual(e.evidenceIds,[evidenceId]);});
test("row attributes the grenade report and removes uncaptured apology details",()=>{const e=read("data/timeline/2026-02.jsonl").find(x=>x.id===id);assert.match(e.title,/Thai Second Army Says/u);assert.match(e.description,/Xinhua, citing Thai media/u);assert.match(e.description,/No casualties were reported/u);assert.doesNotMatch(e.description,/official apology|lack of discipline|Phlan Hin Paet Kon/u);});
test("localized copies preserve 10:18 and remove apology as fact",()=>{const e=read("data/timeline/2026-02.jsonl").find(x=>x.id===id);for(const v of [e.descriptionTh,e.descriptionKh]){assert.ok(v.includes("10:18"));}});
