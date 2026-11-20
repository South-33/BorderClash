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

test("Cambodia conscription chronology separates Cabinet, Assembly and enactment stages", () => {
  const april = readJsonl("data/timeline/2026-04.jsonl");
  const may = readJsonl("data/timeline/2026-05.jsonl");

  const cabinet = april.find((row) => row.id === "ks7eckx7ykr0gm1kdn5ccc5xbh85k9jq");
  assert.ok(cabinet);
  assert.equal(cabinet.date, "2026-04-23");
  assert.equal(cabinet.timeOfDay, undefined);
  assert.match(cabinet.description, /Cabinet approved an urgent draft/u);
  assert.deepEqual(cabinet.evidenceIds, ["80cfdc68fe63c18a66179dacc0477f1d"]);

  const assembly = may.find((row) => row.id === "ks77bpjmzw8xswhq2f5v3c0j9x86y0wd");
  assert.ok(assembly);
  assert.equal(assembly.date, "2026-05-12");
  assert.equal(assembly.timeOfDay, undefined);
  assert.match(assembly.description, /114 of 114/u);
  assert.match(assembly.description, /24 months/u);
  assert.deepEqual(assembly.evidenceIds, ["e496c6cc0a987562ba4a296801d578ae"]);

  const enacted = may.find((row) => row.id === "ks78zz1ypa04hv1ptwad8sj76n87de5d");
  assert.ok(enacted);
  assert.equal(enacted.date, "2026-05-23");
  assert.equal(enacted.timeOfDay, undefined);
  assert.match(enacted.description, /Royal Decree signed on May 23/u);
  assert.match(enacted.description, /Senate adopted it on May 20/u);
  assert.match(enacted.description, /up to 5 years/u);
  assert.deepEqual(enacted.evidenceIds, [
    "cb7a7b17d79e7f130aeb5084ef0e9929",
    "k977jgprx7rq4dd3t9737xq2p587cgbq",
  ]);

  assert.equal(
    may.some((row) => row.id === "ks78g24ejb1ck3bxse9m43x4nd87vz7m"),
    false,
  );
});
