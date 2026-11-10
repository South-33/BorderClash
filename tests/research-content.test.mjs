import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EOL } from "node:os";
import test from "node:test";
import { loadContentQuality } from "../lib/content-quality.mjs";

test("visible research copy is localized and reader-first", async () => {
  const quality = await loadContentQuality();
  assert.equal(quality.unsafeEnglishFallbacks, 0, `visible English cross-language fallbacks: ${quality.unsafeEnglishFallbacks}`);
  assert.equal(quality.missingThai, 0, `visible Thai title fallbacks: ${quality.missingThai}`);
  assert.equal(quality.missingKhmer, 0, `visible Khmer title fallbacks: ${quality.missingKhmer}`);
  assert.equal(quality.localizedIssues, 0, quality.issues.join("\n"));
});

test("generated cycle context stays compact enough for AGY file reads", () => {
  const result = spawnSync(process.execPath, ["scripts/research.mjs", "context"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^# BorderClash cycle context/mu);
  const productionText = result.stdout.trimEnd().split(/\r?\n/u).join(EOL) + EOL;
  assert.ok(Buffer.byteLength(productionText, "utf8") <= 3500, `cycle context too large: ${Buffer.byteLength(productionText, "utf8")} bytes`);
  assert.doesNotMatch(result.stdout, /https?:\/\//u, "cycle context should keep source URLs on demand");
});
