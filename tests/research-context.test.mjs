import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EOL } from "node:os";
import test from "node:test";
test("generated cycle context stays compact enough for AGY file reads", () => {
  const result = spawnSync(process.execPath, ["research/cli.mjs", "context"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^# BorderClash cycle context/mu);
  assert.match(result.stdout, /not verified truth/u);
  assert.match(result.stdout, /Research reference time:/u);
  assert.match(result.stdout, /## Current repository state/u);
  assert.match(result.stdout, /## Latest retained evidence anchors/u);
  assert.match(result.stdout, /snapshot of what the repository currently says, not verified truth/u);
  assert.match(result.stdout, /A no-change cycle is valid/u);
  assert.match(result.stdout, /## Recent repository context/u);
  assert.doesNotMatch(result.stdout, /## Research window/u);
  assert.doesNotMatch(result.stdout, /2025 deaths/u);
  assert.match(result.stdout, /## Source mix across the latest 20 visible records per environment \(context, not a quota\)/u);
  assert.match(result.stdout, /Thailand domestic:/u);
  assert.match(result.stdout, /Cambodia domestic:/u);
  assert.match(result.stdout, /Finish when the record is in the best state the evidence supports/u);
  assert.doesNotMatch(result.stdout, /After 3 searches/u);
  const productionText = result.stdout.trimEnd().split(/\r?\n/u).join(EOL) + EOL;
  assert.ok(Buffer.byteLength(productionText, "utf8") <= 4500, `cycle context too large: ${Buffer.byteLength(productionText, "utf8")} bytes`);
  assert.doesNotMatch(result.stdout, /https?:\/\//u, "cycle context should keep source URLs on demand");
});
