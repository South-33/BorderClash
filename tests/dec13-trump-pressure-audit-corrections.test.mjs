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

test("Dec 13 Trump milestone absorbs later publication-date pressure rows and preserves conflicting tariff accounts", () => {
  const timeline = readJsonl("data/timeline/2025-12.jsonl");
  const survivor = timeline.find((row) => row.id === "ks77b6xg32zh9gt6f04d5mecqh813b3s");
  assert.ok(survivor);
  assert.equal(survivor.date, "2025-12-13");
  assert.equal(survivor.timeOfDay, undefined);
  assert.match(survivor.description, /had not agreed to a ceasefire/u);
  assert.match(survivor.description, /hold anyone accountable as necessary/u);
  assert.match(survivor.description, /Wall Street Journal/u);
  assert.match(survivor.description, /threatened to raise tariffs/u);
  assert.match(survivor.description, /tariffs would not be linked/u);
  assert.match(survivor.description, /Fighting continued/u);
  assert.deepEqual(survivor.evidenceIds, [
    "k97bf52b4tctfzm3jggwbgcbs17x85q6",
    "js75x4f283x8eqa48zrfqx31757x7yae",
    "js7175kg3r97ms3hdgxaqfnrph7x86kd",
    "jn774n9wymtk33rd1g5fbg5qys7xaybk",
  ]);

  assert.equal(
    timeline.some((row) => row.id === "ks7a6e2xab378mdkg5sstq667h81216z"),
    false,
  );
  assert.equal(
    timeline.some((row) => row.id === "ks7darbebptzj4skenck92y8an813v4m"),
    false,
  );
});
