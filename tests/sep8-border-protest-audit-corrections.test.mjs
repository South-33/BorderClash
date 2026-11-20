import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("September 8 protest keeps the supported date while removing fake time and citation artifacts", () => {
  const event = readJsonl("data/timeline/2026-09.jsonl")
    .find((row) => row.id === "ks73cnxmmrcneg43qrvga2w8pn8e2yck");
  const news = readJsonl("data/news/2026-09.jsonl");
  const akp = news.find((row) => row.id === "441d78134328cc462d4bf7f8c3e387e2");
  const khmerTimes = news.find((row) => row.id === "jn78mf8kgcjfrv2swd9tmf4qcn8e2vqt");

  assert.ok(event);
  assert.ok(akp);
  assert.ok(khmerTimes);
  assert.equal(event.date, "2026-09-08");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(`${event.description} ${event.descriptionTh} ${event.descriptionKh}`.includes("[cite:"), false);
  assert.match(event.description, /Cambodia alleged/u);
  assert.match(event.description, /does not independently establish sovereignty/u);
  assert.deepEqual(event.evidenceIds, [akp.id, khmerTimes.id]);
  assert.equal(akp.provenanceId, "cambodia-mfa-sep8-border-protest");
  assert.equal(khmerTimes.provenanceId, akp.provenanceId);
  assert.match(khmerTimes.summary, /On September 8/u);
});
