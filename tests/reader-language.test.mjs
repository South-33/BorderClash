import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

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
