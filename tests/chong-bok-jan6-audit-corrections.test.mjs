import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path) { return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse); }

test("Chong Bok/Mom Bei record keeps conflicting accounts without inventing a shared exact time", () => {
  const event = readJsonl("data/timeline/2026-01.jsonl").find((row) => row.id === "ks71sa0m5w25s8pg5931vfp1md813nb1");
  assert.ok(event);
  assert.equal(event.date, "2026-01-06");
  assert.equal(Object.hasOwn(event, "timeOfDay"), false);
  assert.match(event.title, /Accounts Differ/u);
  assert.match(event.description, /Thailand said Cambodian forces fired/u);
  assert.match(event.description, /did not retaliate/u);
  assert.match(event.description, /07:27/u);
  assert.match(event.description, /different account/u);
  assert.match(event.description, /does not establish one common exact event time/u);
  assert.doesNotMatch(event.description, /January 9/u);
  assert.deepEqual(event.evidenceIds, ["f0f180a344dd2410016febe239c719f8", "86b3f5de6a837484a9b00639ea6700c9", "jn76cdxqzwbmd8y7te1jec8aed7yprnz"]);
});