import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { EOL } from "node:os";
import test from "node:test";
test("generated cycle context stays compact enough for AGY file reads", () => {
  const result = spawnSync(process.execPath, ["research/cli.mjs", "context"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const guide = readFileSync("research/CYCLE_GUIDE.md", "utf8").trim();
  assert.match(result.stdout, /^# BorderClash research cycle/mu);
  assert.ok(result.stdout.includes(guide), "cycle context should embed the canonical research guide");
  assert.match(result.stdout, /Research reference time:/u);
  const productionText = result.stdout.trimEnd().split(/\r?\n/u).join(EOL) + EOL;
  assert.ok(Buffer.byteLength(productionText, "utf8") <= 10000, `cycle context too large: ${Buffer.byteLength(productionText, "utf8")} bytes`);
  assert.doesNotMatch(result.stdout, /https?:\/\//u, "cycle context should keep source URLs on demand");
});
