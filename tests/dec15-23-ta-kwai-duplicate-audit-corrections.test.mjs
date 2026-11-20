import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const survivorId = "ks72wpb6rsdygv6ba3rzb4y3zx812188";
const duplicateId = "ks7arc6kkvzc5pcym7axta0n658134gs";
const directBriefingEvidenceId = "js7dces6bvf00mqj264sp4nj2d7xbjsy";

test("Ta Kwai retaking keeps the older Dec 15 milestone and removes the Dec 23 duplicate", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const survivor = timeline.find((row) => row.id === survivorId);
  const duplicate = timeline.find((row) => row.id === duplicateId);

  assert.ok(survivor);
  assert.equal(duplicate, undefined);
  assert.equal(survivor.date, "2025-12-15");
  assert.equal(survivor.timeOfDay, "12:00");
  assert.match(survivor.title, /^Thai Forces Say/u);
  assert.match(survivor.description, /Thai Defence Ministry spokesperson/u);
  assert.match(survivor.description, /does not independently resolve the underlying sovereignty dispute/u);
  assert.doesNotMatch(survivor.description, /evacuat/u);
  assert.deepEqual(survivor.evidenceIds, [directBriefingEvidenceId]);
});
