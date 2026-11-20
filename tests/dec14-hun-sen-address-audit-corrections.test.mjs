import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(path)=>readFileSync(path,"utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const eventId="ks7br7y7xyz5g3aw2h4w391jdx813g3d";
const evidenceId="jne51b1e45a055d8984bb2e1fdd5ddb8";

test("unsupported Dec 14 Hun Sen address milestone is removed",()=>{
 const timeline=read("data/timeline/2025-12.jsonl");
 assert.equal(timeline.some(row=>row.id===eventId),false);
 assert.equal(timeline.some(row=>row.evidenceIds?.includes(evidenceId)),false);
});

test("blocked Fresh News metadata is retained only with explicit limitations",()=>{
 const article=read("data/news/2025-12.jsonl").find(row=>row.id===evidenceId);
 assert.ok(article);
 assert.equal(article.status,"archived");
 assert.equal(article.credibility,40);
 assert.match(article.summary,/article body could not be captured/u);
 assert.match(article.summary,/metadata-only item does not source-verify/u);
 assert.match(article.summary,/09:20/u);
 assert.match(article.summary,/prime minister in December 2025/u);
});
