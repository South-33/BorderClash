import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import { currentImpactPublic } from "../research/lib/current-shape.mjs";
import { militaryAssessmentFor } from "../research/lib/military-assessment.mjs";

test("user-facing dashboard files remain on the approved UI contract", () => {
  const expected = new Map([
    ["src/app/DashboardClient.tsx", "e17619f632ae2a794a0cd1b69ecf32bff6df7c9d837f93dfd41d9e7caf8a3c6a"],
    ["src/app/research-timing.ts", "09d03a502c4d8f8fccff48beb5e3cfda494ab21bf1c6f89ed41da352ffb018af"],
    ["src/app/hooks/useCascadeLayout.ts", "2d166db404d84f047849c9210c681915156d6c93c637d2a2d2fce23857f59a15"],
    ["src/app/globals.css", "0b5230dbff4dd1c93610bbcf88e52a26cb0b4e8cac0e41e9be4ef2a365f68518"],
    ["src/app/layout.tsx", "31ad313338967e7c5ae0501b7d0bed894b765c9942cb486811c62ccb69704267"],
    ["src/app/loading.tsx", "3e1c0933f619ef400a9c4abbaed0e29a4bf4c6fd63f01e9a9556fde2e7000033"],
    ["src/app/page.tsx", "953d7ea3f70f8f90d3d514454868a7b7bfa404da6bbe356c2c57cf03827097e7"],
    ["src/app/translations.ts", "db78a7574ba5cc88c00aad54a72b4faed8814643dbf33f08a19c799d6727257d"],
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

test("open dashboards check a tiny status artifact only when freshness matters", () => {
  const source = fs.readFileSync("src/app/DashboardClient.tsx", "utf8");
  assert.match(source, /fetch\(`\/data\/status\.json\?research=\$\{now\}`/u);
  assert.doesNotMatch(source, /fetch\(`\/data\/dashboard\.json\?research=/u);
  assert.match(source, /cache: 'no-store'/u);
  assert.match(source, /publishedResearchAt > loadedResearchAt/u);
  assert.match(source, /snapshot\.deploymentVersion !== loadedDeploymentVersion/u);
  assert.match(source, /window\.location\.reload\(\)/u);
  assert.match(source, /document\.addEventListener\('visibilitychange', handleVisibilityChange\)/u);
  assert.match(source, /window\.addEventListener\('focus', handleFocus\)/u);
  assert.match(source, /now - lastCheckedAt < 15_000/u);
  const timing = fs.readFileSync("src/app/research-timing.ts", "utf8");
  assert.match(timing, /RESEARCH_RUNNING_CHECK_MS = 30_000/u);
  assert.match(timing, /RESEARCH_OVERDUE_CHECK_MS = 60_000/u);
  assert.match(source, /startTargetWindowChecks\(\)/u);
});

test("research target shows RUNNING before it becomes overdue", () => {
  const source = fs.readFileSync("src/app/DashboardClient.tsx", "utf8");
  const timing = fs.readFileSync("src/app/research-timing.ts", "utf8");
  assert.match(timing, /RESEARCH_RUNNING_GRACE_SECONDS = 20 \* 60/u);
  assert.match(timing, /phase: 'running'/u);
  assert.match(timing, /phase: 'overdue'/u);
  assert.match(source, /getResearchTimerPhase\(remainingSeconds\)/u);
  assert.match(source, /animate-pulse text-riso-accent.*runningLabel/su);
  assert.match(source, />\+\{formatCountdown\(timerPhase\.seconds\)\}<\/span>/u);
});

test("timeline source previews use the dashboard icon system instead of mojibake glyphs", () => {
  const source = fs.readFileSync("src/app/DashboardClient.tsx", "utf8");
  assert.match(source, /<FileText size=\{9\} strokeWidth=\{2\} aria-hidden="true" \/>/u);
  assert.doesNotMatch(source, /ðŸ|Ã|Â|�/u);
});

test("timeline date navigation keeps the latest request in control of motion and visibility", () => {
  const source = fs.readFileSync("src/app/DashboardClient.tsx", "utf8");
  assert.match(source, /directDomUpdates: true/u);
  assert.match(source, /const animation = rows\.animate\(/u);
  assert.doesNotMatch(source, /setTimeout\(finishProgrammaticScroll/u);
  assert.match(source, /rowVirtualizer\.cancelScroll\(\);[\s\S]*setIsScrollJump\(false\);/u);
  assert.match(source, /await waitForOpacity\(timelineScrollRef\.current, 0\)/u);
  assert.match(source, /container\.addEventListener\('wheel', unlockScroll/u);
  assert.match(source, /container\.addEventListener\('touchstart', unlockScroll/u);
  assert.match(source, /rangeExtractor: \(range\) =>/u);
  assert.match(source, /setTimelinePreloadTargetIndex\(index\);[\s\S]*scrollToDateRef\.current\(date, behavior, true\)/u);
  assert.match(source, /const isFirstMeasure = !instance\.itemSizeCache\.has\(item\.key\)/u);
  assert.match(source, /\[rowVirtualizer, viewMode, lang, showMinorEvents, containerWidth, forceMobile, isLayoutReady\]/u);
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
  assert.match(generator, /status\.json/u);
  assert.match(generator, /statusBytes/u);
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
