import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const researchPath = path.join(root, "convex", "research.ts");
const historianPath = path.join(root, "convex", "historian.ts");
const aiUtilsPath = path.join(root, "convex", "ai_utils.ts");
const apiPath = path.join(root, "convex", "api.ts");
const languageQualityPath = path.join(root, "convex", "language_quality.ts");
const sourceEvidencePath = path.join(root, "convex", "source_evidence.ts");
const configPath = path.join(root, "convex", "config.ts");
const convexServerPath = path.join(root, "src", "lib", "convex-server.ts");
const pagePath = path.join(root, "src", "app", "page.tsx");
const dashboardClientPath = path.join(root, "src", "app", "DashboardClient.tsx");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing marker: ${startMarker}`);

  const end = endMarker ? source.indexOf(endMarker, start) : source.length;
  assert.notEqual(end, -1, `Missing marker: ${endMarker}`);

  return source.slice(start, end);
}

test("Convex pipeline sources transpile cleanly in isolation", () => {
  for (const file of ["convex/research.ts", "convex/historian.ts", "convex/source_evidence.ts"]) {
    const result = spawnSync(
      "node",
      ["--experimental-strip-types", "--check", file],
      {
        cwd: root,
        encoding: "utf8",
      },
    );

    assert.equal(
      result.status,
      0,
      [result.stdout, result.stderr].filter(Boolean).join("\n"),
    );
  }
});

test("core multilingual pipeline sources have clean UTF-8 text", () => {
  for (const filePath of [researchPath, historianPath, aiUtilsPath, apiPath, languageQualityPath, dashboardClientPath]) {
    const source = read(filePath);
    assert.ok(!source.startsWith("\uFEFF"), `${path.basename(filePath)} contains a UTF-8 BOM`);
    assert.ok(!source.includes("\uFFFD"), `${path.basename(filePath)} contains replacement characters`);
    assert.doesNotMatch(source, /(?:ðŸ|â(?:œ||š|†|‡|€)|ï¸)/u, `${path.basename(filePath)} contains likely mojibake`);
  }
});

test("Bing News curation parser extracts publisher URLs and enforces the date window", () => {
  const fixture = `<rss><channel>
    <item><title>Thailand and Cambodia border update</title><link>https://www.bing.com/news/apiclick.aspx?url=https%3A%2F%2Fexample.org%2Fborder-update&amp;c=1</link><description>Fresh summary</description><pubDate>Wed, 04 Nov 2026 09:00:00 GMT</pubDate><News:Source>Example News</News:Source></item>
    <item><title>Old border update</title><link>https://www.bing.com/news/apiclick.aspx?url=https%3A%2F%2Fexample.org%2Fold-update&amp;c=2</link><description>Old summary</description><pubDate>Sun, 01 Nov 2026 09:00:00 GMT</pubDate><News:Source>Example News</News:Source></item>
  </channel></rss>`;
  const moduleUrl = pathToFileURL(sourceEvidencePath).href;
  const script = `
    const m = await import(${JSON.stringify(moduleUrl)});
    const result = m.parseBingNewsCandidates(
      ${JSON.stringify(fixture)},
      Date.parse("2026-11-03T17:00:00Z"),
      Date.parse("2026-11-05T17:00:00Z")
    );
    process.stdout.write(JSON.stringify(result));
  `;
  const result = spawnSync(
    "node",
    ["--experimental-strip-types", "--input-type=module", "-e", script],
    { cwd: root, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const candidates = JSON.parse(result.stdout);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].id, "n1");
  assert.equal(candidates[0].source, "Example News");
  assert.equal(candidates[0].sourceUrl, "https://example.org/border-update");
  assert.equal(candidates[0].publishedAt, "2026-11-04T09:00:00.000Z");
});

test("deterministic source verifier is conservative and evidence-backed", () => {
  const moduleUrl = pathToFileURL(sourceEvidencePath).href;
  const script = `
    const m = await import(${JSON.stringify(moduleUrl)});
    const stored = {
      title: "Nearly 8,000 Cambodians remain displaced along Thai border despite ceasefire, Cambodia says",
      summary: "Cambodia says civilians remain displaced along the Thailand border after the ceasefire.",
      source: "Anadolu Agency",
      sourceUrl: "https://www.aa.com.tr/en/asia-pacific/example/123",
    };
    const base = {
      requestedUrl: stored.sourceUrl,
      gatheredAt: "2026-11-05T00:00:00.000Z",
      googleNews: { query: "example", items: [] },
    };
    const exact = m.assessSourceEvidence({
      ...base,
      direct: {
        status: "ok", httpStatus: 200, finalUrl: stored.sourceUrl,
        title: stored.title,
        description: stored.summary,
      },
    }, stored);
    const rss = m.assessSourceEvidence({
      ...base,
      direct: { status: "blocked", httpStatus: 403, finalUrl: stored.sourceUrl },
      googleNews: {
        query: "example",
        items: [{ title: stored.title + " - Anadolu", source: "Anadolu Agency", sourceUrl: "https://www.aa.com.tr/" }],
      },
    }, stored);
    const dead = m.assessSourceEvidence({
      ...base,
      direct: { status: "dead", httpStatus: 404, finalUrl: stored.sourceUrl, reason: "HTTP 404" },
    }, stored);
    const ambiguous = m.assessSourceEvidence({
      ...base,
      direct: { status: "ok", httpStatus: 200, finalUrl: stored.sourceUrl, title: "Unrelated sports results" },
    }, stored);
    process.stdout.write(JSON.stringify({ exact, rss, dead, ambiguous }));
  `;
  const result = spawnSync(
    "node",
    ["--experimental-strip-types", "--input-type=module", "-e", script],
    { cwd: root, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const assessments = JSON.parse(result.stdout);
  assert.equal(assessments.exact.status, "VERIFIED");
  assert.equal(assessments.rss.status, "VERIFIED");
  assert.equal(assessments.dead.status, "URL_DEAD");
  assert.equal(assessments.ambiguous.status, "SKIP");
});

test("localized text validator rejects mixed Thai and Khmer scripts", () => {
  const moduleUrl = pathToFileURL(languageQualityPath).href;
  const script = `
    const m = await import(${JSON.stringify(moduleUrl)});
    const result = {
      badKhmer: m.getLocalizedTextIssue("ประเทศไทยទម្លាក់ថវិកា ៣.៥ ប៊ីាន់បាត", "kh"),
      badThai: m.getLocalizedTextIssue("กัมพูชา និងไทย", "th"),
      goodKhmer: m.getLocalizedTextIssue("ថៃបែងចែកថវិកា ៣,៥ ពាន់លានបាត", "kh"),
      goodThai: m.getLocalizedTextIssue("ไทยเริ่มการหารือภายใต้ UNCLOS", "th"),
    };
    process.stdout.write(JSON.stringify(result));
  `;
  const result = spawnSync(
    "node",
    ["--experimental-strip-types", "--input-type=module", "-e", script],
    { cwd: root, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), {
    badKhmer: "wrong-script",
    badThai: "wrong-script",
    goodKhmer: null,
    goodThai: null,
  });
});

test("legacy localized tone guard catches high-confidence loaded wording", () => {
  const moduleUrl = pathToFileURL(languageQualityPath).href;
  const script = `
    const m = await import(${JSON.stringify(moduleUrl)});
    const result = {
      sideTaking: m.getLocalizedStyleIssue("\\u0E40\\u0E23\\u0E32", "th", "The army denied the allegation"),
      loadedCountry: m.getLocalizedStyleIssue("\\u0E40\\u0E02\\u0E21\\u0E23", "th", "Cambodia joined the meeting"),
      neutralCountry: m.getLocalizedStyleIssue("\\u0E01\\u0E31\\u0E21\\u0E1E\\u0E39\\u0E0A\\u0E32", "th", "Cambodia joined the meeting"),
      sourceFirstPerson: m.getLocalizedStyleIssue("\\u0E40\\u0E23\\u0E32", "th", "We will attend the meeting"),
    };
    process.stdout.write(JSON.stringify(result));
  `;
  const result = spawnSync(
    "node",
    ["--experimental-strip-types", "--input-type=module", "-e", script],
    { cwd: root, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), {
    sideTaking: "side-taking-tone",
    loadedCountry: "non-neutral-country-label",
    neutralCountry: null,
    sourceFirstPerson: null,
  });

  const dashboard = read(dashboardClientPath);
  assert.match(dashboard, /getLocalizedStyleIssue\(thai, 'th', english\)/);
  assert.match(dashboard, /getLocalizedStyleIssue\(khmer, 'kh', english\)/);
});

test("research pipeline retries and handoff guards exist on all chained steps", () => {
  const source = read(researchPath);

  assert.match(source, /const ACTION_RETRY_DELAYS_MS = \[5000, 15000\]/);
  assert.match(source, /const STEP_RETRY_DELAYS_MS = \[60_000, 5 \* 60_000\]/);
  assert.match(source, /const CURATION_OUTAGE_RETRY_DELAYS_MS = \[5 \* 60 \* 60_000, 24 \* 60 \* 60_000\]/);
  assert.match(source, /async function scheduleStepRetry/);
  assert.match(source, /async function scheduleCurationOutageRetry/);
  assert.match(source, /async function scheduleRunAfterWithRetries/);
  assert.match(source, /async function scheduleRunAtWithRetries/);

  const watchdog = section(source, "export const recoverStuckCycle", "export const curateCambodia");
  assert.doesNotMatch(watchdog, /stats\.isPaused \|\| stats\.systemStatus === "stopped"/);
  assert.match(watchdog, /stats\.isPaused \? undefined : await/);
  assert.match(watchdog, /scheduling remained paused/);
  assert.match(watchdog, /nextRunAt: stats\.isPaused \? stats\.nextRunAt : nextRunAt/);

  const step1 = section(source, "export const runResearchCycle", "export const step2_verification");
  assert.match(step1, /stats\?\.isPaused \|\| stats\?\.systemStatus === "stopped"/);
  assert.match(step1, /skipped reason=paused_or_stopped/);
  assert.match(step1, /releaseCycleLock, \{ runId \}/);
  assert.match(step1, /cambodiaResult = await ctx\.runAction\(internal\.research\.curateCambodia/);
  assert.match(step1, /thailandResult = await ctx\.runAction\(internal\.research\.curateThailand/);
  assert.match(step1, /internationalResult = await ctx\.runAction\(internal\.research\.curateInternational/);
  assert.doesNotMatch(step1, /runWithRetries\(\s*"\[STEP 1\].*curation"/s);
  assert.match(step1, /scheduleCurationOutageRetry\(ctx, attempt\)/);
  assert.match(step1, /scheduleStepRetry\(/);
  assert.match(step1, /scheduleRunAfterWithRetries\(ctx, "Step 2"/);

  const step2 = section(source, "export const step2_verification", "export const step3_historian");
  assert.match(step2, /attempt: v\.optional\(v\.number\(\)\)/);
  assert.match(step2, /stats\?\.isPaused && stats\?\.systemStatus !== "stopped"/);
  assert.match(step2, /setStatus, \{ status: "online" \}/);
  assert.match(step2, /stats\.cycleRunId !== runId \|\| stats\.systemStatus !== "syncing"/);
  assert.match(step2, /skipped stale_run/);
  assert.match(step2, /runWithRetries\(\s*"\[STEP 2\] Source verification"/s);
  assert.match(step2, /scheduleStepRetry\(/);
  assert.match(step2, /scheduleRunAfterWithRetries\(ctx, "Step 3"/);
  assert.match(step2, /Verification: \$\{verifyResult\.errors\} article\(s\) left unverified/);

  const step3 = section(source, "export const step3_historian", "export const step4_synthesis");
  assert.match(step3, /stats\?\.isPaused && stats\?\.systemStatus !== "stopped"/);
  assert.match(step3, /setStatus, \{ status: "online" \}/);
  assert.match(step3, /stats\.cycleRunId !== runId \|\| stats\.systemStatus !== "syncing"/);
  assert.match(step3, /skipped stale_run/);
  assert.match(step3, /runWithRetries\(\s*`\[STEP 3\] Timeline refresh iteration \$\{historianLoops\}`/s);
  assert.match(step3, /runWithRetries\(\s*`\[STEP 3\] Historian iteration \$\{historianLoops\}`/s);
  assert.match(step3, /getRecentTimelineContextForHistorian, \{ limit: 12 \}/);
  assert.doesNotMatch(step3, /getRecentNewsContextForHistorian/);
  assert.match(step3, /runHistorianCycleInternal\(ctx, \{/);
  assert.doesNotMatch(step3, /ctx\.runAction\(internal\.historian\.runHistorianCycle/);
  assert.match(step3, /scheduleStepRetry\(/);
  assert.match(step3, /scheduleRunAfterWithRetries\(ctx, "Step 4"/);

  const step4 = section(source, "export const step4_synthesis", "export const verifyAllSources");
  assert.match(step4, /stats\?\.isPaused && stats\?\.systemStatus !== "stopped"/);
  assert.match(step4, /setStatus, \{ status: "online" \}/);
  assert.match(step4, /stats\.cycleRunId !== runId \|\| stats\.systemStatus !== "syncing"/);
  assert.match(step4, /skipped stale_run/);
  assert.match(step4, /attempt > 0 && typeof stats\.lastResearchAt === "number"/);
  assert.match(step4, /currentDashboard\.lastUpdatedAt > stats\.lastResearchAt/);
  assert.match(step4, /late_synthesis_already_published/);
  assert.match(step4, /runWithRetries\(\s*"\[STEP 4\] Synthesis"/s);
  assert.match(step4, /\(\) => synthesizeAllInternal\(ctx\)/);
  assert.doesNotMatch(step4, /ctx\.runAction\(internal\.research\.synthesizeAll/);
  assert.match(step4, /scheduleStepRetry\(/);
  assert.match(step4, /synthesis_unavailable retrying_step_without_rerunning_research=true/);
  assert.match(step4, /scheduleRunAtWithRetries\(\s*ctx,\s*"Next runResearchCycle"/s);
  assert.match(step4, /if \(!synthesisSucceeded\) \{/);
  assert.match(step4, /ctx\.runMutation\(internal\.api\.publishDashboardSnapshot, \{\}\)/);
  assert.match(step4, /Published fallback dashboard snapshot with previous analysis/);
});

test("synthesis outage retries at the normal minimum interval", () => {
  const source = read(researchPath);
  assert.match(source, /SYNTHESIS_FALLBACK_INTERVAL_HOURS = 4/);
  assert.match(source, /Gemini synthesis unavailable; operational retry in 4h/);
});

test("historian action loop isolates item failures instead of aborting the batch", () => {
  const source = read(historianPath);
  const loop = section(
    source,
    "for (const action of historianResult.actions)",
    "// IMPORTANT: Also mark any selected articles that the AI forgot to include in its response",
  );

  assert.match(loop, /try \{\s*switch \(action\.action\)/s);
  assert.match(loop, /returnedTitles\.add\(searchTitle\)/);
  assert.match(loop, /Failed to apply action/);
  assert.doesNotMatch(source, /verifiedCredibility|credibilityReason/);
  assert.doesNotMatch(source, /updateArticleCredibility/);
});

test("source verification batch isolates per-result failures", () => {
  const source = read(researchPath);
  const evidence = read(sourceEvidencePath);
  const api = read(path.join(root, "convex", "api.ts"));
  const dedupe = read(path.join(root, "convex", "dedupe.ts"));
  const verify = section(source, "export const verifyAllSources", "export const verifySingleSource");

  assert.match(verify, /const BATCH_SIZE = 3;/);
  assert.match(verify, /collectSourceEvidence\(article\.sourceUrl/);
  assert.match(verify, /assessSourceEvidence\(evidence, \{/);
  assert.doesNotMatch(verify, /callGeminiStudio/);
  assert.doesNotMatch(verify, /verificationPrompt/);
  assert.match(evidence, /async function validatePublicUrl/);
  assert.match(evidence, /lookup\(hostname, \{ all: true, verbatim: true \}\)/);
  assert.match(evidence, /private\/reserved IP is not allowed/);
  assert.match(evidence, /non-standard web port is not allowed/);
  assert.match(evidence, /redirect: "manual"/);
  assert.match(evidence, /MAX_HTML_BYTES = 320_000/);
  assert.match(evidence, /https:\/\/news\.google\.com\/rss\/search/);
  assert.match(evidence, /export function assessSourceEvidence/);
  assert.match(evidence, /status: "VERIFIED" \| "URL_DEAD" \| "SKIP"/);
  assert.match(evidence, /evidence\.direct\.status === "dead"/);
  assert.match(evidence, /Same-publisher Google News RSS strongly matches/);
  assert.match(verify, /for \(const r of results\)/);
  assert.match(verify, /const findDuplicateForArticle =/);
  assert.match(verify, /findVerifiedDuplicateCandidate/);
  assert.match(verify, /if \(r\.status === "VERIFIED"\)/);
  assert.match(verify, /if \(r\.status === "URL_DEAD"\)/);
  assert.match(verify, /Ambiguous\/blocked evidence is preserved/);
  assert.match(verify, /catch \(resultError\)/);
  assert.match(verify, /Error processing verification result for/);
  assert.match(api, /export const getArticlesNeedingVerification = internalQuery/);
  assert.match(api, /verificationCutoff = Date\.now\(\) - \(7 \* 24 \* 60 \* 60 \* 1000\)/);
  assert.match(api, /q\.eq\("status", "unverified"\)\.gte\("publishedAt", verificationCutoff\)/);
  assert.match(api, /export const getRecentDuplicateCandidates = internalQuery/);
  const flagArticle = section(api, "export const flagArticle", "export const deleteArticle");
  const markProcessed = section(api, "export const markAsProcessedToTimeline", "Clear processedToTimeline flag on ALL articles");
  assert.match(flagArticle, /withIndex\("by_title"[\s\S]*?\.collect\(\)/);
  assert.match(flagArticle, /let countDelta = 0/);
  assert.match(markProcessed, /withIndex\("by_title"[\s\S]*?\.collect\(\)/);
  assert.match(dedupe, /export const canonicalizeArticleUrl = \(rawUrl\?: string\): string =>/);
  assert.match(dedupe, /export function findVerifiedDuplicateCandidate/);

  const lowCred = section(api, "export const getLowCredArticles", "export const getRecentBreakingNews");
  const breaking = section(api, "export const getRecentBreakingNews", "HISTORIAN CONTEXT");
  const historianQueue = section(api, "export const getUnprocessedForTimeline", "export const markAsProcessedToTimeline");
  assert.doesNotMatch(lowCred, /eq\("status", "unverified"\)/);
  assert.doesNotMatch(breaking, /eq\("status", "unverified"\)/);
  assert.doesNotMatch(historianQueue, /eq\("status", "unverified"\)/);
});

test("curation uses feed-backed deterministic ingestion without Gemini", () => {
  const research = read(researchPath);
  const evidence = read(sourceEvidencePath);
  const api = read(path.join(root, "convex", "api.ts"));

  assert.match(research, /collectCurationCandidates/);
  assert.match(evidence, /export async function collectCurationCandidates/);
  assert.match(evidence, /www\.bing\.com\/news\/search/);
  assert.match(evidence, /searchParams\.get\("url"\)/);
  assert.match(evidence, /CURATION_WINDOW_MS = 48 \* 60 \* 60 \* 1000/);
  assert.match(evidence, /mentionsCambodia/);
  assert.match(evidence, /mentionsThailand/);
  assert.match(evidence, /urlYearMatch/);
  assert.match(research, /collectCurationCandidates\(country, \{ targetDate \}\)/);
  assert.match(research, /if \(discovery\.error && discovery\.candidates\.length === 0\) throw new Error/);
  assert.match(research, /async function insertFeedCandidates/);
  assert.match(research, /credibility: 60/);
  assert.doesNotMatch(research, /preverified: true/);
  assert.doesNotMatch(api, /preverified: v\.optional\(v\.boolean\(\)\)/);
  assert.match(api, /status: "unverified"/);
  assert.match(research, /return await insertFeedCandidates\(ctx, "cambodia", discovery\.candidates, "feed-backed curation"\)/);
  assert.match(research, /return await insertFeedCandidates\(ctx, "thailand", discovery\.candidates, "feed-backed curation"\)/);
  assert.match(research, /return await insertFeedCandidates\(ctx, "international", discovery\.candidates, "feed-backed curation"\)/);
  assert.match(research, /const result = await insertFeedCandidates\(ctx, country, candidates, "manual feed backfill"\)/);
  const curation = section(research, "export const curateCambodia", "// COMBINED SYNTHESIS");
  assert.doesNotMatch(curation, /callGeminiStudio|GEMINI_THINKING|useSearch/);
  assert.doesNotMatch(research, /buildCurationPrompt|processNewsResponse|CURATION_PROMPT_MAX_CHARS/);
  assert.doesNotMatch(
    section(research, "export const curateCambodia", "export const curateThailand"),
    /getExistingTitlesInternal/,
  );
  assert.doesNotMatch(
    section(research, "export const curateThailand", "export const curateInternational"),
    /getExistingTitlesInternal/,
  );
});

test("shared Gemini parsing and translation guidance remain hardened", () => {
  const research = read(researchPath);
  const aiUtils = read(aiUtilsPath);
  const historian = read(historianPath);
  const languageQuality = read(languageQualityPath);
  const api = read(path.join(root, "convex", "api.ts"));
  const config = read(configPath);

  assert.match(aiUtils, /const unwrapJsonStringEnvelope = \(input: string\): string =>/);
  assert.match(aiUtils, /replace\(\/\\\\\(\?=\[!<>&`\]\)\/g, ""\)/);
  assert.match(aiUtils, /replace\(\/\\\\\(\?!\["\\\\\/bfnrtu\]\)\/g, "\\\\\\\\"/);
  assert.match(aiUtils, /fenced ```json blocks first/);
  assert.match(aiUtils, /export function isCompletedGeminiFailure/);
  assert.match(aiUtils, /includes\("gemini request failed:"\)/);
  assert.match(aiUtils, /includes\("gemini async job exceeded"\)/);
  assert.match(aiUtils, /includes\("gemini async job disappeared after submission"\)/);
  assert.match(aiUtils, /server_retry_budget_exhausted localRetry=false/);
  assert.match(aiUtils, /request\.body\.async = true/);
  assert.match(aiUtils, /\/v1\/chat\/completions\/\$\{encodeURIComponent\(request\.requestId\)\}/);
  assert.match(aiUtils, /if \(response\.status !== 202\)/);
  assert.match(aiUtils, /data\?\.status === "failed"/);
  assert.match(config, /GEMINI_STUDIO_CONTROL_URL = process\.env\.GEMINI_STUDIO_CONTROL_URL \|\| GEMINI_STUDIO_API_URL/);
  assert.match(aiUtils, /\/v1\/endpoint/);
  assert.match(aiUtils, /geminiEndpointCache/);
  assert.match(aiUtils, /resolveGeminiDataPlane\(controller\.signal, true\)/);
  assert.match(aiUtils, /: normalizeBaseUrl\(GEMINI_STUDIO_CONTROL_URL\)/);
  assert.match(aiUtils, /response\.status >= 520 && response\.status <= 530/);
  assert.match(aiUtils, /attempt <= 5/);
  assert.match(aiUtils, /async_job_missing resubmit=true/);
  assert.match(aiUtils, /resubmittedAfterRestart/);
  assert.match(languageQuality, /export const LOCALIZED_WRITING_RULES/);
  assert.match(languageQuality, /ordinary reader with no military, legal, or diplomatic background/);
  assert.match(languageQuality, /Never mix Thai and Khmer scripts/);
  assert.match(languageQuality, /normal target-language form of country and place names/);
  assert.match(languageQuality, /Translate meaning, attribution, and uncertainty/);
  assert.match(languageQuality, /Apply the same standard to Thailand and Cambodia/);
  assert.match(languageQuality, /silently check every Thai and Khmer field/);
  assert.match(languageQuality, /assertRequiredLocalizedText/);
  assert.match(research, /\$\{LOCALIZED_WRITING_RULES\}/);
  assert.match(historian, /\$\{LOCALIZED_WRITING_RULES\}/);
  assert.match(research, /repairSynthesisLocalizations\(result\)/);
  assert.match(historian, /repairHistorianLocalizations\(historianResult, selectedArticles\)/);
  assert.match(historian, /articleTranslations/);
  assert.match(historian, /localizationUpdate\.newTitleTh = translations\.titleTh/);
  assert.match(historian, /localizationUpdate\.newTitleKh = translations\.titleKh/);
  assert.match(historian, /localizationUpdate\.newSummaryTh = translations\.summaryTh/);
  assert.match(historian, /localizationUpdate\.newSummaryKh = translations\.summaryKh/);
  assert.match(aiUtils, /LOCALIZATION-REPAIR/);
  assert.match(aiUtils, /callGeminiStudioWithSelfHealing<\{ items\?: LocalizedRepairResult\[\] \}>\([\s\S]*\{ thinkingLevel, timeoutMs \},\s*1,\s*"LOCALIZATION-REPAIR"/);
  assert.match(aiUtils, /thinkingLevel: GeminiThinkingLevel = GEMINI_THINKING\.repair/);
  assert.match(aiUtils, /Repair only requested BorderClash translations from English/);
  assert.match(aiUtils, /Preserve facts, numbers, attribution and uncertainty/);
  assert.match(aiUtils, /Thai must contain no Khmer script; Khmer must contain no Thai script/);
  assert.match(aiUtils, /Stay neutral: no side-taking/);
  assert.match(aiUtils, /poll_transport_error retry_same_job=true/);
  assert.match(aiUtils, /geminiEndpointCache = null;[\s\S]*continue;/);
  assert.match(historian, /repairLocalizedItems\(items, 570_000, GEMINI_THINKING\.repair\)/);
  assert.match(historian, /candidates\.sort\(\(a, b\) => a\.english\.length - b\.english\.length/);
  assert.match(historian, /MAX_BATCH_ENGLISH_CHARS = 600/);
  assert.match(historian, /Math\.min\(6, Math\.round\(args\.batchSize \?\? 6\)\)/);
  assert.match(historian, /acquireTimelineLocalizationRepairLock/);
  assert.match(historian, /releaseTimelineLocalizationRepairLock/);
  assert.match(api, /export const acquireTimelineLocalizationRepairLock = internalMutation/);
  assert.match(api, /const STALE_MS = 30 \* 60 \* 1000/);
  assert.match(api, /export const releaseTimelineLocalizationRepairLock = internalMutation/);
  assert.match(api, /assertRequiredLocalizedText\("titleTh", args\.titleTh, "th"\)/);
  assert.match(api, /validateTimelineLocalizationUpdates\(args\.updates\)/);
  assert.match(api, /assertValidLocalizedArray\("keyEventsTh"/);
  assert.match(api, /validateOptionalNewsLocalizations\(args\)/);
  assert.match(
    section(api, "export const updateArticleValidation", "export const createTimelineEvent"),
    /validateOptionalNewsLocalizations\(\{\s*titleTh: args\.titleTh,\s*titleKh: args\.titleKh,/s,
  );
  assert.doesNotMatch(historian, /List each article with your analysis plan FIRST/);
  assert.match(historian, /Return EXACTLY one fenced \\`\\`\\`json code block and nothing else/);
  assert.match(historian, /isCompletedGeminiFailure\(error\)/);
  assert.match(historian, /\[HISTORIAN\] server_retry_budget_exhausted localRetry=false/);
});

test("synthesis context avoids duplicate weighting and non-browsed URLs", () => {
  const research = read(researchPath);
  const aiUtils = read(aiUtilsPath);
  const api = read(path.join(root, "convex", "api.ts"));

  assert.match(research, /const lowCredByKey = new Map/);
  assert.match(research, /canonicalizeArticleUrl\(article\.sourceUrl\)/);
  assert.match(research, /duplicate URLs merged/);
  assert.doesNotMatch(
    section(research, "const lowCredList =", "console.log(`[SYNTHESIS] context"),
    /URL: \$\{a\.sourceUrl/,
  );
  assert.match(api, /const seen = new Set<string>\(\)/);
  assert.match(api, /canonicalizeArticleUrl\(article\.sourceUrl\)/);
  assert.doesNotMatch(section(aiUtils, "export function formatTimelineEvent", null), /\$\{s\.url\}/);
});

test("historian collapses cross-feed duplicate source stories before Gemini", () => {
  const historian = read(historianPath);

  assert.match(historian, /canonicalizeArticleUrl\(article\.sourceUrl\)/);
  assert.match(historian, /const articleGroups = new Map<string, any\[\]>\(\)/);
  assert.match(historian, /const uniqueArticles: any\[\] = \[\]/);
  assert.match(historian, /const selectedArticles = uniqueArticles\.slice\(0, historianBatchSize\)/);
  assert.match(historian, /duplicateRows=\$\{allArticles\.length - uniqueArticles\.length\}/);
  assert.match(historian, /const articleGroup = articleGroups\.get\(articleGroupKey\(article\)\) \?\? \[article\]/);
  assert.match(historian, /if \(duplicate\.title === article\.title\)/);
  assert.match(historian, /if \(articleSummary && duplicateSummary === articleSummary\)/);
  assert.match(historian, /processedRows/);
});

test("Gemini requests use Flash with Medium and High thinking only", () => {
  const research = read(researchPath);
  const historian = read(historianPath);
  const aiUtils = read(aiUtilsPath);
  const config = read(configPath);
  const verifyScript = read(path.join(root, "scripts", "verify-gemini-headers.mjs"));

  assert.match(config, /GEMINI_MODEL = "flash" as const/);
  assert.match(config, /GEMINI_MEDIUM_FALLBACK = "high" as const/);
  assert.doesNotMatch(config, /curation:/);
  assert.match(config, /repair: "medium"/);
  assert.match(config, /historian: "high"/);
  assert.match(config, /synthesis: "high"/);
  assert.match(config, /manager: "high"/);
  assert.match(aiUtils, /model:\s*GEMINI_MODEL/);
  assert.match(aiUtils, /thinking_level:\s*thinkingLevel/);
  assert.match(aiUtils, /thinkingLevel === "medium"/);
  assert.match(aiUtils, /body\.fallback_thinking_level = GEMINI_MEDIUM_FALLBACK/);
  assert.doesNotMatch(aiUtils, /GeminiModelConfig|callGeminiStudioWithFallback|resolveGeminiModel|THINKING_LEVEL_SUFFIXES/);
  assert.doesNotMatch(config, /"flash-lite"|"pro"|"low"|"standard"|"extended"/i);
  assert.doesNotMatch(research, /"SOURCE-VERIFY",\s*undefined,\s*true/);
  assert.doesNotMatch(research, /"VERIFY-SINGLE",\s*undefined,\s*true/);
  assert.doesNotMatch(aiUtils, /attemptsSeq|thinkingSuffix/);
  assert.match(historian, /limit: 12/);
  assert.match(historian, /const historianBatchSize = 3/);
  assert.match(historian, /\[HISTORIAN\] request articles=\$\{articles\.length\} timeline=\$\{existingTimeline\.length\} promptChars=\$\{prompt\.length\}/);
  assert.match(historian, /useSearch: false/);
  assert.doesNotMatch(historian, /runPlanner\(/);
  assert.match(research, /getRecentTimelineContextForHistorian, \{ limit: 12 \}/);
  assert.match(research, /getRecentTimeline, \{ limit: 12 \}/);
  assert.match(research, /getLowCredArticles, \{ country: "cambodia", limit: 2 \}/);
  assert.match(research, /getLowCredArticles, \{ country: "thailand", limit: 2 \}/);
  assert.match(research, /getLowCredArticles, \{ country: "international", limit: 2 \}/);
  assert.match(research, /getRecentBreakingNews, \{ limit: 8 \}/);
  assert.match(research, /\[SYNTHESIS\] request promptChars=\$\{prompt\.length\}/);
  assert.match(verifyScript, /const thinkingLevels = \["medium", "high"\]/);
  assert.match(verifyScript, /model:\s*"flash"/);
  assert.match(verifyScript, /fallback_thinking_level = "high"/);
  assert.doesNotMatch(research, /GEMINI_THINKING\.curation/);
  assert.doesNotMatch(
    section(research, "export const verifyAllSources", "// MANUAL BACKFILL TOOL"),
    /callGeminiStudio|thinkingLevel: GEMINI_THINKING\.verification/,
  );
  assert.match(research, /thinkingLevel: GEMINI_THINKING\.synthesis/);
  assert.match(historian, /thinkingLevel: GEMINI_THINKING\.historian/);
});

test("ISR server fetch uses a retried dashboard snapshot and lets page errors bubble to ISR", () => {
  const convexServer = read(convexServerPath);
  const api = read(path.join(root, "convex", "api.ts"));
  const page = read(pagePath);
  const dashboardClient = read(dashboardClientPath);

  assert.match(convexServer, /const SERVER_QUERY_RETRY_DELAYS_MS = \[750, 2000\]/);
  assert.match(convexServer, /async function queryWithRetries/);
  assert.match(convexServer, /client\.query\(api\.api\.getDashboardSnapshot, \{\}\)/);
  assert.match(convexServer, /const snapshot = await queryWithRetries<Omit<BorderClashData, "fetchedAt">>/);
  assert.doesNotMatch(convexServer, /async function queryWithFallback/);
  assert.doesNotMatch(convexServer, /degraded: boolean/);
  assert.doesNotMatch(convexServer, /fetchWarnings: string\[]/);
  assert.match(api, /\.query\("dashboardSnapshots"\)/);
  assert.match(api, /const \[thailandNews, cambodiaNews, timelineEvents, systemStats, articleCounts\] = await Promise\.all\(/);
  assert.match(api, /getTimelineData\(ctx, DASHBOARD_TIMELINE_PREVIEW_LIMIT\)/);
  assert.match(api, /export const getRecentTimelineContextForHistorian = internalQuery/);
  assert.match(api, /thailandAnalysis: snapshot\.thailandAnalysis/);
  assert.match(api, /timelineEvents,/);
  assert.match(api, /const assembledSnapshot = await assembleDashboardSnapshotData\(ctx\)/);
  assert.match(api, /export const publishDashboardSnapshot = internalMutation/);
  assert.match(api, /withIndex\("by_status_publishedAt", \(q: any\) => q\.eq\("status", "active"\)\)/);
  assert.doesNotMatch(api, /\.query\(table\)\s*\.order\("desc"\)\s*\.take\(targetLimit\)/);
  assert.match(dashboardClient, /api\.api\.getTimeline/);
  assert.match(dashboardClient, /viewMode !== 'TIMELINE'/);
  assert.match(dashboardClient, /clientTimelineEvents \?\? timelinePreviewEvents/);

  assert.match(page, /const initialData: BorderClashData = await fetchBorderClashData\(\)/);
  assert.doesNotMatch(page, /catch\s*\(/);
  assert.doesNotMatch(page, /serverError/);
});

test("resume paths restore a missing precise research schedule", () => {
  const api = read(path.join(root, "convex", "api.ts"));
  const resumeHelper = section(api, "async function resumeResearchScheduling", "export const resumeTimer");
  const resumeTimer = section(api, "export const resumeTimer", "export const stopResearchCycle");
  const resumeCycle = section(api, "export const resumeResearchCycle", "// Skip ONLY the next research cycle");

  assert.match(resumeHelper, /_scheduled_functions/);
  assert.match(resumeHelper, /research\.js:runResearchCycle/);
  assert.match(resumeHelper, /research\.ts:runResearchCycle/);
  assert.match(resumeHelper, /ctx\.scheduler\.cancel\(job\._id\)/);
  assert.match(resumeHelper, /ctx\.scheduler\.runAt\(runAt, internal\.research\.runResearchCycle, \{\}\)/);
  assert.match(resumeHelper, /scheduledRunId/);
  assert.match(resumeTimer, /resumeResearchScheduling\(ctx, existing\)/);
  assert.match(resumeCycle, /resumeResearchScheduling\(ctx, existing\)/);
});

test("pending research job lookup matches Convex compiled function names", () => {
  const api = read(path.join(root, "convex", "api.ts"));
  const pending = section(api, "export const getPendingCycleJobs", "// Internal mutation to SET skipNextCycle flag");

  assert.match(pending, /research\.js:runResearchCycle/);
  assert.match(pending, /research\.ts:runResearchCycle/);
});
