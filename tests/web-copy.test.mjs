import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import { militaryAssessmentFor, riskLevelFromTiers } from "../research/lib/military-assessment.mjs";

test("user-facing dashboard files remain on the pre-audit UI contract", () => {
  const expected = new Map([
    ["src/app/DashboardClient.tsx", "80035414494da4f447ed8f1611549e2b40b11a0fb51f52ca71a60169589cb0db"],
    ["src/app/translations.ts", "35535d9a298327da1062688c28bcbea1d92afe01ddd8b6aba8e0a842df3924b8"],
  ]);
  for (const [file, hash] of expected) {
    const source = fs.readFileSync(file, "utf8").replace(/\r\n/gu, "\n");
    assert.equal(
      createHash("sha256").update(source).digest("hex"),
      hash,
      `${file} changed; UI changes require an explicit UI task`,
    );
  }
});

test("government impact figures preserve claimant and reporting outlet separately", () => {
  const impact = JSON.parse(fs.readFileSync("data/current/impact.json", "utf8"));
  assert.equal(impact.displaced.claimantName, "Cambodia Ministry of Interior");
  assert.equal(impact.displaced.sourceName, "Kampuchea Thmey Daily");
  assert.notEqual(impact.displaced.claimantName, impact.displaced.sourceName);
  assert.ok(impact.displaced.claimantNameTh, "Thai claimant attribution missing");
  assert.ok(impact.displaced.claimantNameKh, "Khmer claimant attribution missing");
});

test("military gauge values are derived from fixed evidence tiers", () => {
  const tiers = [];
  for (const country of ["thailand", "cambodia"]) {
    const current = JSON.parse(fs.readFileSync(`data/current/${country}.json`, "utf8"));
    const assessment = current.militaryAssessment;
    const derived = militaryAssessmentFor(assessment.tier);
    assert.ok(derived, `${country} has an invalid military tier`);
    assert.equal(Object.hasOwn(assessment, "score"), false, `${country} stores a free-form score`);
    assert.equal(Object.hasOwn(assessment, "posture"), false, `${country} stores a free-form posture`);
    assert.ok(assessment.evidenceIds.length > 0, `${country} military tier has no evidence`);
    tiers.push(assessment.tier);
  }
  assert.equal(militaryAssessmentFor("FORTIFIED").score, 40);
  assert.equal(militaryAssessmentFor("FORTIFIED").posture, "DEFENSIVE");
  assert.equal(riskLevelFromTiers(...tiers), "LOW");
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
