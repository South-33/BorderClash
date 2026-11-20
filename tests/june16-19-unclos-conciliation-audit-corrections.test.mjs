import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path){return readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse)}
const appointmentId="ks7f96vtq164v13njvfcpz8j9n88we0s";
const duplicateAppointmentId="ks74dmrstkwrnmyc4tepf6rqts8919h7";
const responseId="ks7eazhdgzqw5wp2zmcvqftv0x88yec1";
const duplicateResponseId="ks75bw0qvj0ygf0bm75m7btw5h8936we";
test("June UNCLOS chronology keeps one appointment and one formal response milestone",()=>{
 const rows=readJsonl("data/timeline/2026-06.jsonl");
 const appointment=rows.find(r=>r.id===appointmentId); const response=rows.find(r=>r.id===responseId);
 assert.ok(appointment); assert.ok(response);
 assert.equal(appointment.date,"2026-06-16"); assert.equal(response.date,"2026-06-19"); assert.equal(response.timeOfDay,"");
 assert.equal(rows.some(r=>r.id===duplicateAppointmentId),false); assert.equal(rows.some(r=>r.id===duplicateResponseId),false);
 assert.ok(appointment.evidenceIds.includes("k97af51s1grryvqksa4ykcxcgn8912ck"));
 assert.deepEqual(response.evidenceIds,["js7d6m4j2bqbkdqcfzapf4svan88zc9h","jn76472fnehhd2wkxby5y1a451893jew"]);
 assert.match(response.title,/Compulsory Conciliation/u); assert.match(response.description,/not arbitration/u); assert.match(response.description,/no exact submission time/u);
});
test("Khmer Times summary preserves the June 19 response and legal mechanism",()=>{
 const article=readJsonl("data/news/2026-06.jsonl").find(r=>r.id==="jn76472fnehhd2wkxby5y1a451893jew"); assert.ok(article);
 assert.match(article.summary,/submitted its formal Response/u); assert.match(article.summary,/on June 19/u);
 assert.match(article.summary,/previously appointed conciliators/u); assert.match(article.summary,/compulsory conciliation, not arbitration/u);
});
