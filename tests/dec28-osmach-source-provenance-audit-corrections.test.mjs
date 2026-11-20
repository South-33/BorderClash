import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const provenanceId = "oddar-meanchey-osmach-dec28-barriers";
const ids = [
  "jn75f2w9w1d2s9tjdcsrybw9h580jx09",
  "jn7csggr6k9gx354w7nrp8wx3s80wrap",
  "jn7axz81610z45yqnnqbdyrd1580t7th",
];

test("O'Smach Cambodian reports share one provincial-authority provenance chain", () => {
  const rows = readJsonl("data/news/2026-02.jsonl");
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const id of ids) {
    assert.equal(byId.get(id)?.provenanceId, provenanceId);
  }
});

test("unresolved territorial allegation does not exceed credibility 60", () => {
  const rows = readJsonl("data/news/2026-02.jsonl");
  const byId = new Map(rows.map((row) => [row.id, row]));
  assert.equal(byId.get("jn75f2w9w1d2s9tjdcsrybw9h580jx09")?.credibility, 50);
  assert.equal(byId.get("jn7csggr6k9gx354w7nrp8wx3s80wrap")?.credibility, 50);
  assert.equal(byId.get("jn7axz81610z45yqnnqbdyrd1580t7th")?.credibility, 60);
});
