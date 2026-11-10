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
    '"Risk Level"',
    '"ESTIMATED LOSS"',
    "AI-verified intelligence",
    "absolutely zero human intervention",
    "THE CURATOR",
    "THE VERIFIER",
    "THE HISTORIAN",
    "THE SYNTHESIZER",
    "TRUST NO ONE BLINDLY",
    "Rumor/Fake",
    "Likely true",
    "Source Score",
    "Every government has an incentive to lie",
  ]) {
    assert.equal(source.includes(phrase), false, `reader-facing jargon returned: ${phrase}`);
  }
});

test("dashboard does not restore unsourced conflict classifications", () => {
  const source = fs.readFileSync("src/app/DashboardClient.tsx", "utf8");
  for (const phrase of ["riskLevel", "displayPosture", "PEACEFUL", "DEFENSIVE", "ESCALATED", "AGGRESSIVE"]) {
    assert.equal(source.includes(phrase), false, `unsourced classification returned: ${phrase}`);
  }
});

test("government impact figures preserve the claimant separately from the reporting outlet", () => {
  const impact = JSON.parse(fs.readFileSync("data/current/impact.json", "utf8"));
  const dashboard = fs.readFileSync("src/app/DashboardClient.tsx", "utf8");
  assert.equal(impact.displaced.claimantName, "Cambodia Ministry of Interior");
  assert.equal(impact.displaced.sourceName, "Kampuchea Thmey Daily");
  assert.notEqual(impact.displaced.claimantName, impact.displaced.sourceName);
  assert.ok(impact.displaced.claimantNameTh, "Thai claimant attribution missing");
  assert.ok(impact.displaced.claimantNameKh, "Khmer claimant attribution missing");
  assert.match(dashboard, /impact\.displaced\.claimantName/u, "dashboard does not render claimant attribution");
  assert.match(dashboard, /t\.reportedBy/u, "dashboard does not explain the reporting relationship");
});

test("guide explains the real research system and evidence score", () => {
  const source = fs.readFileSync("src/app/translations.ts", "utf8");
  for (const phrase of [
    "01 — DISCOVERY",
    "02 — SOURCE CHECK",
    "03 — RECORD UPDATE",
    "04 — VALIDATION AND PUBLISH",
    "NEUTRALITY IS A METHOD, NOT A GUARANTEE",
    "It is not a probability that the story is true",
    "85-100: Strong evidence",
    "60-84: Useful attributable reporting",
    "0-59: Limited, single-source",
  ]) {
    assert.equal(source.includes(phrase), true, `guide is missing: ${phrase}`);
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
