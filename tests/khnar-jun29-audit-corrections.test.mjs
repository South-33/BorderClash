import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Khnar AOT complaint is anchored to the June 29 letter and June 26 incident", () => {
  const june = readJsonl("data/timeline/2026-06.jsonl");
  const july = readJsonl("data/timeline/2026-07.jsonl");
  const event = june.find((row) => row.id === "ks72tad1bevq9f87ezn401z5p989rp66");
  const news = readJsonl("data/news/2026-07.jsonl");

  assert.ok(event);
  assert.equal(july.some((row) => row.id === event.id), false);
  assert.equal(event.date, "2026-06-29");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /June 29 AOT Complaint/u);
  assert.match(event.description, /June 26 incident/u);
  assert.match(event.description, /does not independently resolve the sovereignty claim/u);
  assert.deepEqual(event.evidenceIds, [
    "d5fc1c58e367f8057c0fd04f33f519bf",
    "jn723ky8434gqzdcankndvgq5d89rskr",
    "k97fy2mamwhvdzma09gdmrwbbs89sxr8",
  ]);

  const provenanceId = "rcaf-jun29-khnar-aot-complaint";
  for (const id of event.evidenceIds) assert.equal(news.find((row) => row.id === id)?.provenanceId, provenanceId);
  assert.match(news.find((row) => row.id === "jn723ky8434gqzdcankndvgq5d89rskr")?.summary || "", /complaint letter dated June 29/u);
  assert.match(news.find((row) => row.id === "jn723ky8434gqzdcankndvgq5d89rskr")?.summary || "", /June 26 incident/u);
});
