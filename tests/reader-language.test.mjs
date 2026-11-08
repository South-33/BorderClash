import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadContentQuality } from "../lib/content-quality.mjs";

test("visible dashboard copy is localized and reader-first", async () => {
  const quality = await loadContentQuality();
  assert.equal(quality.unsafeEnglishFallbacks, 0, `visible English cross-language fallbacks: ${quality.unsafeEnglishFallbacks}`);
  assert.equal(quality.missingThai, 0, `visible Thai title fallbacks: ${quality.missingThai}`);
  assert.equal(quality.missingKhmer, 0, `visible Khmer title fallbacks: ${quality.missingKhmer}`);
  assert.equal(quality.localizedIssues, 0, quality.issues.join("\n"));
  assert.equal(quality.jargonHits, 0, `plain-language jargon: ${quality.jargon.join(", ")}`);
  assert.ok(quality.maxEnglishSentenceWords <= 32, `English analysis sentence too long: ${quality.maxEnglishSentenceWords} words`);
});

test("main dashboard labels avoid analyst jargon", () => {
  const source = fs.readFileSync("src/app/translations.ts", "utf8");
  for (const phrase of [
    '"Official Narrative"',
    '"Military Posture"',
    '"SITUATION REPORT"',
    '"Key Developments"',
    '"Credibility"',
    '"Threat Level"',
    '"ESTIMATED LOSS"',
    "AI-verified intelligence",
    "absolutely zero human intervention",
  ]) {
    assert.equal(source.includes(phrase), false, `reader-facing jargon returned: ${phrase}`);
  }
});

test("static UI language blocks do not mix Thai and Khmer scripts", () => {
  const source = fs.readFileSync("src/app/translations.ts", "utf8");
  const englishStart = source.indexOf("    en: {");
  const thaiStart = source.indexOf("    th: {");
  const khmerStart = source.indexOf("    kh: {");
  assert.ok(englishStart >= 0 && thaiStart > englishStart && khmerStart > thaiStart, "translation language blocks not found");

  const englishBlock = source.slice(englishStart, thaiStart);
  const thaiBlock = source.slice(thaiStart, khmerStart);
  const khmerBlock = source.slice(khmerStart);

  assert.equal(/[\u0E00-\u0E7F\u1780-\u17FF]/u.test(englishBlock), false, "English UI copy contains Thai or Khmer script");
  assert.equal(/[\u1780-\u17FF]/u.test(thaiBlock), false, "Thai UI copy contains Khmer script");
  assert.equal(/[\u0E00-\u0E7F]/u.test(khmerBlock), false, "Khmer UI copy contains Thai script");
});
