import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import { militaryAssessmentFor, riskLevelFromTiers } from "../research/lib/military-assessment.mjs";

test("user-facing dashboard files remain on the approved UI contract", () => {
  const expected = new Map([
    ["src/app/DashboardClient.tsx", "7d648517dd5c8aac3312e8516b29114fc78677d1cbbef435ae17e5de845195ab"],
    ["src/app/translations.ts", "1640708c36ef27bf7d56a56ae2536220e2561246596ec1ce0b6340c5038abb2b"],
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

test("open dashboards pick up a newly published research snapshot", () => {
  const source = fs.readFileSync("src/app/DashboardClient.tsx", "utf8");
  assert.match(source, /fetch\(`\/data\/dashboard\.json\?research=\$\{Date\.now\(\)\}`/u);
  assert.match(source, /cache: 'no-store'/u);
  assert.match(source, /publishedResearchAt > loadedResearchAt/u);
  assert.match(source, /snapshot\.deploymentVersion !== loadedDeploymentVersion/u);
  assert.match(source, /window\.location\.reload\(\)/u);
  assert.match(source, /isPossiblyStale \? 60_000 : 300_000/u);
});

test("news feeds return to the newest article when their data or filter changes", () => {
  const source = fs.readFileSync("src/app/DashboardClient.tsx", "utf8");
  assert.match(source, /const feedScrollRef = useRef<HTMLDivElement>\(null\)/u);
  assert.match(source, /const articleVersion = `\$\{articles\?\.\[0\]\?\._id \?\? 'none'\}:\$\{articles\?\.length \?\? 0\}`/u);
  assert.match(source, /feedScrollRef\.current\.scrollTop = 0/u);
  assert.match(source, /\[categoryFilter, articleVersion\]/u);
});

test("public dashboard freshness and feed depth follow the static-data contract", () => {
  const generator = fs.readFileSync("scripts/generate-public.mjs", "utf8");
  const news = fs.readFileSync("research/lib/news.mjs", "utf8");
  assert.match(news, /export const PUBLIC_NEWS_LIMIT = 60;/u);
  assert.match(generator, /updatedAt: lastResearchAt \|\| value\.updatedAt/u);
  assert.match(generator, /impactPublic\(impact, thailandPerspective, cambodiaPerspective, researchState\.lastResearchAt\)/u);
  assert.equal(generator.includes("civilianInjuredCount"), false);
  assert.equal(generator.includes("militaryInjuredCount"), false);
});

test("source cards render a real external-link arrow instead of an entity name", () => {
  const source = fs.readFileSync("src/app/DashboardClient.tsx", "utf8");
  assert.equal(source.includes("&nearr;"), false);
  assert.equal((source.match(/↗/gu) || []).length >= 2, true);
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
