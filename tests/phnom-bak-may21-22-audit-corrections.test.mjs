import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Phnom Bak cluster separates the May 21 Thai report from Cambodia's May 22 denial", () => {
  const timeline = readJsonl("data/timeline/2026-05.jsonl");
  const incident = timeline.find((row) => row.id === "ks716pv7r7jsb57cxspr4619e9877kvh");
  const denial = timeline.find((row) => row.id === "ks77m6hp72nbz4v5m0jpv0z3p9876q49");
  const news = readJsonl("data/news/2026-05.jsonl");

  assert.ok(incident);
  assert.ok(denial);
  assert.equal(incident.date, "2026-05-21");
  assert.equal(incident.timeOfDay, "14:20");
  assert.match(incident.title, /Thai Army Reports Five Shots/u);
  assert.match(incident.description, /source establishes Thailand's report, not who fired/u);
  assert.deepEqual(incident.evidenceIds, [
    "71aa813cfb8439d920090e3bece0a187",
    "js7b8nr3a76aba726v37gw0vqh877f2g",
  ]);

  assert.equal(denial.date, "2026-05-22");
  assert.equal(denial.timeOfDay, undefined);
  assert.match(denial.title, /Cambodia Denies Thai Account/u);
  assert.match(denial.description, /conflicting accounts/u);
  assert.deepEqual(denial.evidenceIds, [
    "236ccbd07daa69429854ccb8cd60a2db",
    "71aa813cfb8439d920090e3bece0a187",
    "js7frqyvn8djj22f3fa5fs1sxh876wd2",
  ]);

  const provenanceId = "cambodia-mod-may22-phnom-bak-denial";
  for (const id of [
    "236ccbd07daa69429854ccb8cd60a2db",
    "jn79r5qwtysf29s5wpzydb8035876tkf",
    "js7frqyvn8djj22f3fa5fs1sxh876wd2",
  ]) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, provenanceId);
  }
  assert.match(news.find((row) => row.id === "jn79r5qwtysf29s5wpzydb8035876tkf")?.summary || "", /May 21 at about 14:20/u);
});
