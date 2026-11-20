import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8")
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test("first UNCLOS conciliation meeting concludes on Sep 16 with its procedural framework", () => {
  const timeline = readJsonl("data/timeline/2026-09.jsonl");
  const event = timeline.find((row) => row.id === "ks7edt0qf1pq7af8ja5m3dr87h8erkt1");
  assert.ok(event);
  assert.equal(event.date, "2026-09-16");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /September 14 to 16/u);
  assert.match(event.description, /Terms of Appointment/u);
  assert.match(event.description, /Rules of Procedure/u);
  assert.match(event.description, /further meetings/u);
  assert.deepEqual(event.evidenceIds, [
    "04d0d956e72901e64081a3baf28b3450",
    "dc4dab1f410d9bb21f87b99cfa2dea00",
  ]);
  assert.equal(event.evidenceIds.includes("jn02e2920028114de139dce175ad2905"), false);
});

test("PCA source summary stays within the captured institutional record", () => {
  const news = readJsonl("data/news/2026-09.jsonl");
  const pca = news.find((row) => row.id === "04d0d956e72901e64081a3baf28b3450");
  assert.ok(pca);
  assert.match(pca.summary, /September 14 to 16, 2026/u);
  assert.match(pca.summary, /Article 298 and Annex V of UNCLOS/u);
  assert.doesNotMatch(pca.summary, /opening statements/u);
});
