import assert from "node:assert/strict";
import test from "node:test";
import { loadContentQuality } from "../lib/content-quality.mjs";

test("visible research copy is localized and reader-first", async () => {
  const quality = await loadContentQuality();
  assert.equal(quality.unsafeEnglishFallbacks, 0, `visible English cross-language fallbacks: ${quality.unsafeEnglishFallbacks}`);
  assert.equal(quality.missingThai, 0, `visible Thai title fallbacks: ${quality.missingThai}`);
  assert.equal(quality.missingKhmer, 0, `visible Khmer title fallbacks: ${quality.missingKhmer}`);
  assert.equal(quality.localizedIssues, 0, quality.issues.join("\n"));
});
