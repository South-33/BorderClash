import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import { currentImpactPublic } from "../research/lib/current-shape.mjs";
import { militaryAssessmentFor } from "../research/lib/military-assessment.mjs";

test("user-facing dashboard files remain on the approved UI contract", () => {
  const expected = new Map([
    ["src/app/DashboardClient.tsx", "baeb8610e64d0a29056563f9532fda09aa415098e1b139d5687a531bcbabcf93"],
    ["src/app/globals.css", "5cde188cc1816468ca46c8765b99fc2334ea1f32679bbf3aa01846bc7f8f923b"],
    ["src/app/layout.tsx", "b87d7baefddab9e8c3bcd12f9f18c37a140bb25775df30af13a8759f2b683274"],
    ["src/app/loading.tsx", "3e1c0933f619ef400a9c4abbaed0e29a4bf4c6fd63f01e9a9556fde2e7000033"],
    ["src/app/page.tsx", "953d7ea3f70f8f90d3d514454868a7b7bfa404da6bbe356c2c57cf03827097e7"],
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

test("timeline source previews use the dashboard icon system instead of mojibake glyphs", () => {
  const source = fs.readFileSync("src/app/DashboardClient.tsx", "utf8");
  assert.match(source, /<FileText size=\{9\} strokeWidth=\{2\} aria-hidden="true" \/>/u);
  assert.doesNotMatch(source, /ðŸ|Ã|Â|�/u);
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
  const currentShape = fs.readFileSync("research/lib/current-shape.mjs", "utf8");
  const news = fs.readFileSync("research/lib/news.mjs", "utf8");
  assert.match(news, /export const PUBLIC_NEWS_LIMIT = 60;/u);
  assert.match(currentShape, /updatedAt: lastResearchAt \|\| value\.updatedAt/u);
  assert.match(generator, /currentImpactPublic\(impact, thailandPerspective, cambodiaPerspective, researchState\.lastResearchAt\)/u);
  assert.equal(generator.includes("civilianInjuredCount"), false);
  assert.equal(generator.includes("militaryInjuredCount"), false);
});

test("source cards render a real external-link arrow instead of an entity name", () => {
  const source = fs.readFileSync("src/app/DashboardClient.tsx", "utf8");
  assert.equal(source.includes("&nearr;"), false);
  assert.equal((source.match(/↗/gu) || []).length >= 2, true);
});

test("impact evidence metadata stays internal while qualified public metrics stay compact", () => {
  const impact = {
    updatedAt: 1,
    displaced: {
      value: 12345,
      qualifier: "MORE_THAN",
      claimantName: "Fixture ministry",
      sourceName: "Fixture outlet",
      scope: "Fixture population",
      evidenceIds: ["fixture-evidence"],
    },
    deaths: {
      value: 7,
      qualifier: "AT_LEAST",
      sourceName: "Fixture report",
      scope: "Fixture deaths",
      evidenceIds: ["fixture-evidence"],
    },
  };
  const output = currentImpactPublic(
    impact,
    { militaryAssessment: { tier: "FORTIFIED" } },
    { militaryAssessment: { tier: "FORTIFIED" } },
    99,
  );
  assert.deepEqual(output, {
    riskLevel: "LOW",
    displacedCount: "12,345+",
    deathCount: "7+",
    updatedAt: 99,
  });
  assert.equal(JSON.stringify(output).includes("claimantName"), false);
  assert.equal(JSON.stringify(output).includes("evidenceIds"), false);
});

test("military gauge values are derived from fixed evidence tiers", () => {
  assert.equal(militaryAssessmentFor("FORTIFIED").score, 40);
  assert.equal(militaryAssessmentFor("FORTIFIED").posture, "DEFENSIVE");
  assert.equal(
    currentImpactPublic(
      { displaced: { value: 1 }, deaths: { value: 1 } },
      { militaryAssessment: { tier: "FORTIFIED" } },
      { militaryAssessment: { tier: "INCIDENT" } },
      1,
    ).riskLevel,
    "ELEVATED",
  );
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
