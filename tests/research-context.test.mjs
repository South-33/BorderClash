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
  const productionText = result.stdout.trimEnd().split(/\r?\n/u).join(EOL) + EOL;
  assert.ok(Buffer.byteLength(productionText, "utf8") <= 3500, `cycle context too large: ${Buffer.byteLength(productionText, "utf8")} bytes`);
  assert.doesNotMatch(result.stdout, /https?:\/\//u, "cycle context should keep source URLs on demand");
});
