"use node";

import { internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { FunctionReference } from "convex/server";
import { v } from "convex/values";
import { runHistorianCycleInternal } from "./historian";
import { findVerifiedDuplicateCandidate, type DuplicateCandidate } from "./dedupe";

// Use gemini-studio-api helpers
import { MODELS, FALLBACK_CHAINS } from "./config";
import { callGeminiStudio, callGeminiStudioWithSelfHealing, callGeminiStudioWithFallback, formatTimelineEvent, TRANSLATION_STYLE_GUIDE } from "./ai_utils";


// =============================================================================
// SHARED UTILS (deprecated Ghost API endpoints removed)
// =============================================================================

const ACTION_RETRY_DELAYS_MS = [5000, 15000] as const;
const CHAIN_SCHEDULER_RETRY_DELAYS_MS = [2000, 5000, 10000] as const;
const STEP_RETRY_DELAYS_MS = [60_000, 5 * 60_000] as const;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type SchedulableFunctionReference = FunctionReference<"mutation" | "action", "public" | "internal">;
type SchedulerContext = {
    scheduler: {
        runAfter: (
            delayMs: number,
            functionReference: SchedulableFunctionReference,
            args: Record<string, unknown>,
        ) => Promise<Id<"_scheduled_functions">>;
        runAt: (
            timestamp: number,
            functionReference: SchedulableFunctionReference,
            args: Record<string, unknown>,
        ) => Promise<Id<"_scheduled_functions">>;
    };
};

const summarizeError = (error: unknown): string => {
    if (error instanceof Error && error.message) return error.message;
    return String(error);
};

const isRetryableActionError = (error: unknown): boolean => {
    const message = summarizeError(error).toLowerCase();
    const retryableNeedles = [
        "performasyncsyscall",
        "server error",
        "network",
        "fetch failed",
        "timeout",
        "timed out",
        "abort",
        "econnreset",
        "etimedout",
        "429",
        "rate",
        "quota",
        "temporarily unavailable",
        "bad gateway",
        "gateway timeout",
        "cloudflare",
        "empty response",
        "no json",
        "invalid json",
        "unexpected end of json",
    ];
    return retryableNeedles.some((needle) => message.includes(needle));
};

const isVisibleDuplicateCandidate = (candidate: { status?: string }) =>
    candidate.status === "active" || candidate.status === "unverified";

async function runWithRetries<T>(
    label: string,
    operation: () => Promise<T>,
    retryDelaysMs: readonly number[] = ACTION_RETRY_DELAYS_MS,
    shouldRetry: (error: unknown) => boolean = isRetryableActionError,
): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            const canRetry = attempt < retryDelaysMs.length && shouldRetry(error);
            console.warn(`[RETRY] ${label} failed on attempt ${attempt + 1}/${retryDelaysMs.length + 1}: ${summarizeError(error)}`);
            if (!canRetry) {
                throw error;
            }

            const delayMs = retryDelaysMs[attempt];
            console.log(`[RETRY] ${label} retrying in ${Math.round(delayMs / 1000)}s...`);
            await sleep(delayMs);
        }
    }

    throw lastError;
}

async function scheduleRunAfterWithRetries(
    ctx: SchedulerContext,
    label: string,
    delayMs: number,
    actionReference: SchedulableFunctionReference,
    args: Record<string, unknown>,
): Promise<Id<"_scheduled_functions">> {
    return runWithRetries(
        `[SCHEDULER] ${label}`,
        () => ctx.scheduler.runAfter(delayMs, actionReference, args),
        CHAIN_SCHEDULER_RETRY_DELAYS_MS,
        () => true,
    );
}

async function scheduleRunAtWithRetries(
    ctx: SchedulerContext,
    label: string,
    timestamp: number,
    actionReference: SchedulableFunctionReference,
    args: Record<string, unknown>,
): Promise<Id<"_scheduled_functions">> {
    return runWithRetries(
        `[SCHEDULER] ${label}`,
        () => ctx.scheduler.runAt(timestamp, actionReference, args),
        CHAIN_SCHEDULER_RETRY_DELAYS_MS,
        () => true,
    );
}

async function scheduleStepRetry(
    ctx: SchedulerContext,
    {
        stepName,
        actionReference,
        args,
        attempt,
    }: {
        stepName: string;
        actionReference: SchedulableFunctionReference;
        args: Record<string, unknown>;
        attempt: number;
    },
): Promise<boolean> {
    if (attempt >= STEP_RETRY_DELAYS_MS.length) {
        console.warn(`[${stepName}] Retry budget exhausted after ${attempt} scheduled retries`);
        return false;
    }

    const delayMs = STEP_RETRY_DELAYS_MS[attempt];
    const nextAttempt = attempt + 1;

    await scheduleRunAfterWithRetries(
        ctx,
        `${stepName} retry`,
        delayMs,
        actionReference,
        { ...args, attempt: nextAttempt },
    );

    console.warn(`[${stepName}] Scheduled retry ${nextAttempt}/${STEP_RETRY_DELAYS_MS.length} in ${Math.round(delayMs / 1000)}s`);
    return true;
}

// =============================================================================
// ADAPTIVE SCHEDULER: Heartbeat that checks if it's time to run
// This runs every 4 hours and checks nextRunAt to decide if full cycle should run
// =============================================================================
export const maybeRunCycle = internalAction({
    args: {},
    handler: async (ctx): Promise<{ skipped: boolean; reason?: string; ran?: boolean }> => {
        const stats = await ctx.runQuery(internal.api.getSystemStatsInternal, {});
        const now = Date.now();

        // If system is paused, skip
        if (stats?.isPaused) {
            return { skipped: true, reason: "paused" };
        }

        // If skipNextCycle is set, skip this one and clear the flag
        if (stats?.skipNextCycle) {
            console.log("[SCHEDULER] skipped reason=skipNextCycle");
            await ctx.runMutation(internal.api.clearSkipNextCycle, {});
            return { skipped: true, reason: "skipNextCycle flag" };
        }

        // Check if it's time to run
        const nextRunAt = stats?.nextRunAt || 0;

        if (now < nextRunAt) {
            const hoursUntil = Math.round((nextRunAt - now) / 3600000 * 10) / 10;
            return { skipped: true, reason: `not yet time, ${hoursUntil}h remaining` };
        }

        // Time to run!
        console.log("[SCHEDULER] due action=runResearchCycle");
        await ctx.runAction(internal.research.runResearchCycle, {});

        return { skipped: false, ran: true };
    },
});

// Watchdog: recover from timed-out/stuck cycles that never reached scheduling/finalization.
// If a cycle is still marked as syncing after 45 minutes, force a safe 24h fallback schedule,
// clear the lock, and bring the system back online.
export const recoverStuckCycle = internalAction({
    args: {},
    handler: async (ctx): Promise<{ recovered: boolean; reason: string; nextRunAt?: number }> => {
        const stats = await ctx.runQuery(internal.api.getSystemStatsInternal, {});
        const now = Date.now();

        if (!stats) {
            return { recovered: false, reason: "no system stats record" };
        }

        if (stats.isPaused || stats.systemStatus === "stopped") {
            return { recovered: false, reason: "system paused/stopped" };
        }

        if (stats.systemStatus !== "syncing" || !stats.cycleRunId || !stats.cycleStartedAt) {
            return { recovered: false, reason: "no active syncing cycle" };
        }

        const ZOMBIE_TIMEOUT_MS = 45 * 60 * 1000;
        const cycleAgeMs = now - stats.cycleStartedAt;
        if (cycleAgeMs < ZOMBIE_TIMEOUT_MS) {
            const mins = Math.round(cycleAgeMs / 60000);
            return { recovered: false, reason: `cycle still active (${mins}m)` };
        }

        const FALLBACK_INTERVAL_HOURS = 24;
        const nextRunAt = now + (FALLBACK_INTERVAL_HOURS * 60 * 60 * 1000);
        const recoveryReason = "Automatic fallback scheduling after stuck/timed-out cycle; retrying in 24h";

        // Cancel any pending cycle jobs so we don't stack duplicate runs.
        try {
            const pendingJobIds = await ctx.runQuery(internal.api.getPendingCycleJobs, {});
            if (pendingJobIds.length > 0) {
                console.log(`🗑️ [RECOVERY] Cancelling ${pendingJobIds.length} pending cycle job(s) before fallback scheduling...`);
                for (const jobId of pendingJobIds) {
                    try {
                        await ctx.scheduler.cancel(jobId as any);
                    } catch (cancelError) {
                        console.log(`⚠️ [RECOVERY] Could not cancel ${jobId}: ${cancelError}`);
                    }
                }
            }
        } catch (pendingJobsError) {
            console.log(`⚠️ [RECOVERY] Could not query pending jobs: ${pendingJobsError}`);
        }

        const scheduledRunId = await (async () => {
            try {
                const jobId = await scheduleRunAtWithRetries(
                    ctx,
                    "Next runResearchCycle",
                    nextRunAt,
                    internal.research.runResearchCycle,
                    {},
                );
                console.log(`📅 [RECOVERY] Scheduled fallback run for ${new Date(nextRunAt).toLocaleString()} (24h)`);
                console.log(`   Job ID: ${jobId}`);
                return jobId;
            } catch (scheduleError) {
                console.error(`❌ [RECOVERY] Failed to schedule fallback runAt job: ${scheduleError}`);
                console.log("⏰ [RECOVERY] 24h cron safety net will still retry if no runAt job exists");
                return undefined;
            }
        })();

        await ctx.runMutation(internal.api.setNextRunAt, {
            nextRunAt,
            lastCycleInterval: FALLBACK_INTERVAL_HOURS,
            schedulingReason: recoveryReason,
            scheduledRunId,
        });

        const lockPrefix = stats.cycleRunId.slice(0, 8);
        const minsStuck = Math.round(cycleAgeMs / 60000);
        const errorLog = `Recovery watchdog cleared stuck cycle ${lockPrefix} after ${minsStuck}m; fallback next run set to 24h.`;

        await ctx.runMutation(internal.api.setStatus, {
            status: "online",
            errorLog,
        });

        await ctx.runMutation(internal.api.releaseCycleLock, { runId: stats.cycleRunId });

        console.warn(`🧯 [RECOVERY] Cleared stuck cycle ${lockPrefix} (${minsStuck}m old), set fallback next run in 24h.`);

        return {
            recovered: true,
            reason: errorLog,
            nextRunAt,
        };
    },
});


type CurationCountry = "cambodia" | "thailand" | "international";

const CURATION_PROMPT_MAX_CHARS = 1100;

function buildCurationPrompt(country: CurationCountry): string {
    const profiles: Record<CurationCountry, { perspective: string; scope: string; sources: string }> = {
        cambodia: {
            perspective: "Cambodian civilian",
            scope: "Cambodian outlets, especially Khmer-language",
            sources: "Fresh News, DAP, RFA Khmer, Khmer Times, AKP",
        },
        thailand: {
            perspective: "Thai civilian",
            scope: "Thai outlets, especially Thai-language",
            sources: "Thai Rath, Khaosod, Matichon, Thai PBS, Bangkok Post",
        },
        international: {
            perspective: "neutral outside observer",
            scope: "international wire/global outlets, excluding Thai/Cambodian domestic media",
            sources: "Reuters, AP, AFP, BBC, CNA, UN/ASEAN",
        },
    };
    const profile = profiles[country];
    const prompt = `Use Google Search now for Thailand-Cambodia news from the last 24-48h, from a ${profile.perspective} perspective. Search ${profile.scope}. Start with ${profile.sources}.

Open each candidate. Return only canonical article URLs that load and support the title/summary. Never invent URLs, use image/attachment URLs, or add facts not on the page. Zero results is valid. Score credibility 0-100 from evidence, sourcing, tone, and balance.

Return JSON only:
{"newArticles":[{"title":"English","titleTh":"Thai","titleKh":"Khmer","publishedAt":"explicit page date YYYY-MM-DD/ISO UTC+7, else null","sourceUrl":"https://...","source":"publication","category":"military|political|humanitarian|diplomatic","credibility":0,"summary":"English","summaryTh":"concise Thai","summaryKh":"concise Khmer"}],"flaggedTitles":[]}

Use English numerals. Prioritize fighting, casualties, evacuations, official statements, diplomacy, humanitarian impact. Include propaganda if relevant but score it lower.`;

    if (prompt.length > CURATION_PROMPT_MAX_CHARS) {
        throw new Error(`Curation prompt grew to ${prompt.length} chars; keep it below ${CURATION_PROMPT_MAX_CHARS} to avoid file-upload mode.`);
    }
    return prompt;
}

export const curateCambodia = internalAction({
    args: {},
    handler: async (ctx): Promise<{ newArticles: number; flagged: number; error?: string }> => {
        console.log(`🇰🇭 [CAMBODIA] Curating news via Gemini Studio API...`);

        const prompt = buildCurationPrompt("cambodia");

        return await processNewsResponse(ctx, prompt, "cambodia");
    },
});

// =============================================================================
// STEP 1B: THAILAND NEWS CURATOR
// =============================================================================

export const curateThailand = internalAction({
    args: {},
    handler: async (ctx): Promise<{ newArticles: number; flagged: number; error?: string }> => {
        console.log(`🇹🇭 [THAILAND] Curating news via Gemini Studio API...`);

        const prompt = buildCurationPrompt("thailand");

        return await processNewsResponse(ctx, prompt, "thailand");
    },
});

// =============================================================================
// STEP 1C: INTERNATIONAL NEWS CURATOR (3rd party sources)
// =============================================================================

export const curateInternational = internalAction({
    args: {},
    handler: async (ctx): Promise<{ newArticles: number; flagged: number; error?: string }> => {
        console.log(`🌍 [INTERNATIONAL] Curating news via Gemini Studio API...`);

        const prompt = buildCurationPrompt("international");

        return await processNewsResponse(ctx, prompt, "international");
    },
});

// Shared helper to parse Gemini research output and save articles
async function processNewsResponse(
    ctx: any,
    prompt: string,
    country: "thailand" | "cambodia" | "international"
): Promise<{ newArticles: number; flagged: number; error?: string }> {
    let lastError: any;
    const MAX_RETRIES = 3;

    let currentPrompt = prompt;

    const extractParseErrorPosition = (message: string): number | null => {
        const match = message.match(/position\s+(\d+)/i);
        return match ? Number(match[1]) : null;
    };

    const getJsonErrorSnippet = (input: string, position: number | null): string => {
        if (position === null || !Number.isFinite(position)) return input.substring(0, 200);
        const start = Math.max(0, position - 80);
        const end = Math.min(input.length, position + 80);
        return input.substring(start, end);
    };

    const unwrapJsonStringEnvelope = (input: string): string => {
        const trimmed = input.trim();
        if (!trimmed.startsWith("\"")) return input;

        try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed === "string") {
                return parsed;
            }
        } catch {
            // Fall through to normal cleanup path.
        }

        return input;
    };

    const normalizeJsonCandidate = (input: string): string => {
        let normalized = unwrapJsonStringEnvelope(input).trim();

        for (let i = 0; i < 2; i++) {
            normalized = normalized
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
                .replace(/\\<json>/gi, "<json>")
                .replace(/\\<\/json>/gi, "</json>")
                .replace(/"\[([^\]]*)\]\(([^)]+)\)"/g, '"$2"')
                .replace(/,\s*([\]\}])/g, '$1')
                .replace(/[\uFEFF\u200B\u200C\u200D]/g, '')
                // Models sometimes invent escapes like \! or \&quot; which are illegal in JSON.
                .replace(/\\(?=[!<>&`])/g, "")
                // Any remaining invalid backslash escape should be treated as a literal backslash.
                .replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
        }

        return normalized;
    };

    const extractJsonPayload = (input: string): string | null => {
        const fencedMatch = input.match(/```json\s*([\s\S]*?)```/i);
        if (fencedMatch) {
            return fencedMatch[1].trim();
        }

        const tagMatch = input.match(/<json>([\s\S]*?)<\/json>/i);
        if (tagMatch) {
            return tagMatch[1].trim();
        }

        const cleanedResponse = input
            .replace(/```json\s*/gi, "")
            .replace(/```\s*/g, "")
            .trim();
        const firstOpen = cleanedResponse.indexOf("{");
        const lastClose = cleanedResponse.lastIndexOf("}");
        if (firstOpen !== -1 && lastClose !== -1) {
            return cleanedResponse.substring(firstOpen, lastClose + 1);
        }

        return null;
    };

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        let rawResponse = "";

        try {
            console.log(`🤖 [${country.toUpperCase()}] Attempt ${attempt}/${MAX_RETRIES} (Model: curation)...`);

            // 1. CALL API - Using curation model mapping
            rawResponse = await callGeminiStudio(currentPrompt, MODELS.curation, 1);
            rawResponse = rawResponse
                .replace(/\\<json>/gi, "<json>")
                .replace(/\\<\/json>/gi, "</json>");

            // 2. EXTRACT JSON - Prefer fenced json, then legacy tags, then raw braces
            const extractedJson = extractJsonPayload(rawResponse);
            if (extractedJson) {
                if (/```json/i.test(rawResponse)) {
                    console.log(`✅ [${country.toUpperCase()}] Extracted JSON from fenced code block`);
                } else if (/<json>/i.test(rawResponse)) {
                    console.log(`✅ [${country.toUpperCase()}] Extracted JSON from legacy <json> tags`);
                } else {
                    console.log(`✅ [${country.toUpperCase()}] Extracted JSON from raw object fallback`);
                }
            }

            if (!extractedJson) {
                throw new Error("No JSON object found in response");
            }

            const jsonStr = normalizeJsonCandidate(extractedJson);

            // 3. PARSE
            let result;
            try {
                result = JSON.parse(jsonStr);
            } catch (parseError: any) {
                const errorPosition = extractParseErrorPosition(parseError.message);
                console.log(`⚠️ [${country.toUpperCase()}] Bad JSON snippet: ${getJsonErrorSnippet(jsonStr, errorPosition)}`);
                console.log(`⚠️ [${country.toUpperCase()}] JSON Parse Error on attempt ${attempt}: ${parseError.message}`);

                if (attempt < MAX_RETRIES) {
                    console.log(`🔄 [${country.toUpperCase()}] Constructing repair prompt for next attempt...`);

                    currentPrompt = `Your previous response had invalid JSON. Please fix it.

--- ORIGINAL TASK ---
${prompt}
--- END TASK ---

--- YOUR BROKEN RESPONSE ---
${rawResponse.substring(0, 2000)}${rawResponse.length > 2000 ? '...(truncated)' : ''}
--- END RESPONSE ---

--- ERROR ---
${parseError.message}
---

Problematic JSON snippet:
${getJsonErrorSnippet(jsonStr, errorPosition)}

Return EXACTLY one fenced \`\`\`json code block and NOTHING else.
Inside the fence, output valid JSON only.
Do NOT include prose, apologies, article lists, markdown links, or follow-up questions.

Please output the FIXED JSON only:
\`\`\`json
{"newArticles": [...], "flaggedTitles": []}
\`\`\``;

                    continue; // Loop to next attempt with new prompt
                } else {
                    throw parseError; // Give up
                }
            }

            // 5. SUCCESS - PROCESS ARTICLES
            // (Same helper logic as before for validating URLs/inserting)

            // ... (Insert Logic) ...
            let addedCount = 0;
            let skippedCount = 0;

            // Normalize "newArticles" - sometimes models return just the array, or wrap it differently
            const articles = Array.isArray(result) ? result : (result.newArticles || []);

            // DEBUG: Log what AI actually returned
            console.log(`📋 [${country.toUpperCase()}] AI returned ${articles.length} articles in JSON`);
            if (articles.length === 0) {
                console.log(`📄 [${country.toUpperCase()}] Raw response preview: ${rawResponse.substring(0, 500)}...`);
            }

            // Insert new articles
            for (const article of articles) {
                // VALIDATE and PARSE publishedAt - fall back to fetch time if invalid/missing
                let publishedAt = Date.now(); // Default to fetch time
                if (article.publishedAt && article.publishedAt !== null) {
                    const parsed = new Date(article.publishedAt).getTime();
                    if (!isNaN(parsed)) {
                        // Validate: not in the future, not more than 30 days old
                        const now = Date.now();
                        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
                        const oneDayInFuture = now + (24 * 60 * 60 * 1000);

                        if (parsed > oneDayInFuture) {
                            console.log(`   ⚠️ Rejecting future date for "${article.title?.substring(0, 30)}..." - using fetch time`);
                        } else if (parsed < thirtyDaysAgo) {
                            console.log(`   ⚠️ Rejecting old date (>30 days) for "${article.title?.substring(0, 30)}..." - using fetch time`);
                        } else {
                            publishedAt = parsed; // Valid date, use it
                        }
                    }
                }

                // ====== URL VALIDATION ======
                const url = article.sourceUrl || "";
                let credibilityPenalty = 0;

                // Check URL format
                if (!url || url.length < 10) {
                    console.log(`   ⚠️ Skipping "${article.title?.substring(0, 40)}..." - missing URL`);
                    skippedCount++;
                    continue;
                }

                // Basic URL validation
                try {
                    const parsed = new URL(url);
                    // Check for suspicious patterns
                    if (parsed.hostname.includes("example.com") ||
                        parsed.hostname.includes("fake") ||
                        parsed.hostname.includes("test") ||
                        parsed.hostname.length < 4) {
                        console.log(`   ⚠️ Skipping suspicious URL: ${url}`);
                        skippedCount++;
                        continue;
                    }
                    // Penalize non-HTTPS (less credible)
                    if (parsed.protocol !== "https:") {
                        credibilityPenalty += 5;
                    }
                } catch {
                    console.log(`   ⚠️ Skipping invalid URL format: ${url}`);
                    skippedCount++;
                    continue;
                }

                // Check for AI-generated fake URL patterns
                const suspiciousPatterns = [
                    /\/article\/\d{10,}/, // Suspiciously long numeric IDs
                    /\/news\/[a-f0-9]{32}/, // Random hex strings
                    /example\.com/,
                    /placeholder/,
                    /lorem/,
                ];
                for (const pattern of suspiciousPatterns) {
                    if (pattern.test(url)) {
                        credibilityPenalty += 15;
                        console.log(`   ⚠️ URL looks AI-generated, reducing credibility: ${url.substring(0, 50)}...`);
                        break;
                    }
                }

                // Validate category - default to "political" if invalid
                const validCategories = ["military", "political", "humanitarian", "diplomatic"];
                const category = validCategories.includes(article.category) ? article.category : "political";

                // Apply credibility penalty
                const finalCredibility = Math.max(10, Math.min(100, (article.credibility || 50) - credibilityPenalty));

                // Check if insert was successful (returns null if duplicate)
                const insertResult = await ctx.runMutation(internal.api.insertArticle, {
                    perspective: country,
                    title: article.title,
                    titleEn: article.titleEn,
                    titleTh: article.titleTh,
                    titleKh: article.titleKh,
                    publishedAt,
                    sourceUrl: url,
                    source: article.source,
                    category,
                    credibility: finalCredibility,
                    summary: article.summary,
                    summaryEn: article.summaryEn,
                    summaryTh: article.summaryTh,
                    summaryKh: article.summaryKh,
                });

                if (insertResult !== null) {
                    // Actually inserted
                    addedCount++;
                    const credNote = credibilityPenalty > 0 ? ` (adjusted from ${article.credibility || 50})` : "";
                    console.log(`   ✅ Added: "${(article.titleEn || article.title || "").substring(0, 50)}..." [${finalCredibility}${credNote}]`);
                } else {
                    // Skipped as duplicate
                    skippedCount++;
                }
            }

            if (skippedCount > 0) {
                console.log(`   ⚠️ Skipped ${skippedCount} duplicates/invalid URLs`);
            }

            // Flag outdated articles
            for (const title of result.flaggedTitles || []) {
                await ctx.runMutation(internal.api.flagArticle, {
                    title,
                    status: "outdated",
                    country,
                });
            }

            console.log(`✅ [${country.toUpperCase()}] Added ${addedCount}, skipped ${skippedCount}, flagged ${(result.flaggedTitles || []).length}`);
            return { newArticles: addedCount, flagged: (result.flaggedTitles || []).length };

        } catch (err: any) {
            lastError = err;
            console.error(`❌ [${country.toUpperCase()}] Attempt ${attempt} failed: ${err.message}`);
            // Add delay for network errors to give Cloudflare tunnel time to reconnect
            if (attempt < MAX_RETRIES) {
                console.log(`⏳ [${country.toUpperCase()}] Waiting 8s before retry...`);
                await new Promise(resolve => setTimeout(resolve, 8000));
            }
        }
    }

    // If we get here, all retries failed
    return { newArticles: 0, flagged: 0, error: String(lastError) };
}

// =============================================================================
// COMBINED SYNTHESIS (one Gemini request for all 3 analyses)
// =============================================================================

export const synthesizeAll = internalAction({
    args: {},
    handler: async (ctx): Promise<any> => {
        // ==================== TIMELINE CONTEXT (PRIMARY SOURCE) ====================
        // Timeline events are the verified, structured "memory" of the conflict
        const timeline = await ctx.runQuery(internal.api.getRecentTimeline, { limit: 30 });
        const timelineStats = await ctx.runQuery(internal.api.getTimelineStats, {});

        // Build timeline context using shared helper
        const timelineContext = timeline.length > 0
            ? timeline.map((e: any) => formatTimelineEvent(e)).join("\n\n")
            : "(No timeline events yet)";

        // ==================== STRATIFIED ARTICLE SAMPLING ====================
        // Timeline has verified/credible sources, so we DON'T need high-cred articles again.
        // Instead we focus on:
        // 1. LOW CREDIBILITY (propaganda) - to analyze what each side is lying about
        // 2. BREAKING NEWS (most recent) - to catch current developments
        // This keeps context bounded even as DB grows to 1000s of articles.

        // PHASE 2 OPTIMIZATION: Use specialized indexed queries instead of fetching 300 articles
        // This reduces bandwidth by ~75-80% by fetching exactly what we need

        // ==================== LOW CREDIBILITY / PROPAGANDA (6 per country) ====================
        // Use new indexed query that sorts by credibility at database level
        const [cambodiaLowCred, thailandLowCred, internationalLowCred] = await Promise.all([
            ctx.runQuery(internal.api.getLowCredArticles, { country: "cambodia", limit: 6 }),
            ctx.runQuery(internal.api.getLowCredArticles, { country: "thailand", limit: 6 }),
            ctx.runQuery(internal.api.getLowCredArticles, { country: "international", limit: 6 }),
        ]);

        if (cambodiaLowCred.length === 0 && thailandLowCred.length === 0 && internationalLowCred.length === 0 && timeline.length === 0) {
            console.warn("[SYNTHESIS] skipped reason=no_articles_or_timeline");
            return null;
        }

        // Helper to format article for prompt - numbered for better AI tracking
        const formatArticle = (a: any, idx: number) =>
            `${idx + 1}. [${a.category}] "${a.title}" (${a.source}, cred:${a.credibility || 50})
   URL: ${a.sourceUrl || "(none)"}
   Summary: ${a.summary || "No summary"}`;

        const cambodiaPropaganda = cambodiaLowCred.map((a: any, i: number) => formatArticle(a, i)).join("\n");
        const thailandPropaganda = thailandLowCred.map((a: any, i: number) => formatArticle(a, i)).join("\n");
        const internationalPropaganda = internationalLowCred.map((a: any, i: number) => formatArticle(a, i)).join("\n");

        // ==================== BREAKING NEWS (15 most recent across all) ====================
        // Use new indexed query that fetches from all tables and sorts by publishedAt
        const breakingNews: any[] = await ctx.runQuery(internal.api.getRecentBreakingNews, { limit: 15 });

        const breakingNewsList = breakingNews.map((a: any, idx: number) =>
            `${idx + 1}. [${a.country.toUpperCase()}] [${a.category}] "${a.title}" (${a.source}, cred:${a.credibility || 50})
   URL: ${a.sourceUrl || "(none)"}
   Summary: ${a.summary || "No summary"}`
        ).join("\n");

        console.log(`[SYNTHESIS] context timeline=${timeline.length} avgImportance=${timelineStats.avgImportance} lowCred=kh:${cambodiaLowCred.length},th:${thailandLowCred.length},intl:${internationalLowCred.length} breaking=${breakingNews.length}`);

        // Get previous analysis for context (MEMORY)
        const prevCambodia = await ctx.runQuery(api.api.getAnalysis, { target: "cambodia" }) as any;
        const prevThailand = await ctx.runQuery(api.api.getAnalysis, { target: "thailand" }) as any;
        const prevNeutral = await ctx.runQuery(api.api.getAnalysis, { target: "neutral" }) as any;
        const prevStats = await ctx.runQuery(api.api.getDashboardStats, {}) as any;

        const memoryContext = `
📜 TIMELINE (VERIFIED HISTORICAL RECORD - ${timeline.length} events):
This is the structured memory of key conflict events. Use this as your PRIMARY source of truth.
${timelineContext}

📜 PREVIOUS ANALYSIS (CONTINUITY CONTEXT):
The following was the previous analysis. Think of this as your last report - you're updating it, not starting from scratch.

⚠️ CRITICAL: DON'T BLINDLY FOLLOW THE OLD ANALYSIS!
The previous synthesis might be outdated, flawed, or based on limited information. YOU MUST:
- **Evaluate independently**: Look at the CURRENT timeline and articles. What do THEY tell you?
- **Challenge the old narrative**: Does it still match the evidence? Or was it based on a bias/misreading?
- **Don't auto-continue storylines**: Just because the previous analysis said "escalating tension" doesn't mean you should keep saying that if current evidence shows otherwise.
- **Think for yourself**: The previous analysis is ONE data point. The timeline and articles are your PRIMARY evidence.

🔄 ITERATION GUIDANCE:
- **If the situation is essentially unchanged**: Keep the core narrative and make only minor refinements (update phrasing, add nuance, adjust intensity slightly). You don't need to manufacture a new story every cycle.
- **If there's genuinely new information**: Incorporate it smoothly. Evolve the narrative rather than replacing it entirely.
- **If major developments contradict previous analysis**: Update boldly and explain the shift.
- **Think evolution, not revolution**: Most cycles involve gradual adjustments, not complete rewrites.

Your job is to maintain an accurate, **evolving** narrative - not to create drama where none exists, and not to perpetuate errors from previous cycles.

[PREVIOUS CAMBODIA NARRATIVE]: ${prevCambodia?.officialNarrative || "None"}
[PREVIOUS THAILAND NARRATIVE]: ${prevThailand?.officialNarrative || "None"}
[PREVIOUS NEUTRAL SUMMARY]: ${prevNeutral?.generalSummary || "None"}
[PREVIOUS POSTURE]: Cambodia=${prevCambodia?.militaryPosture}, Thailand=${prevThailand?.militaryPosture}
`;

        const prompt: string = `You are a senior geopolitical analyst providing NEUTRAL but SHARP analysis. You have TWO roles:

💡 TIP: You have the [google_search] tool available. If current news articles don't provide enough clarity or if you need to verify a specific claim, feel free to use it to search for the most recent context.

🎯 FOR CAMBODIA/THAILAND SECTIONS: Provide RESPECTFUL summaries of each country's perspective - what their media reports, how they frame things. You are a REPORTER here, not a judge.

⚖️ FOR THE NEUTRAL SECTION: BE A REFEREE. You're the guy calling out BS, flagging obvious spin, and pointing out when the numbers don't add up. You're fair but you're NOT a pushover. If someone's lying or exaggerating, you say it. Think sports commentator calling a bad call: assertive, clear, no diplomatic fluff.

📰 CONTEXT - HOW THESE ARTICLES WERE COLLECTED:
- CAMBODIAN SOURCES: Domestic news that Cambodian civilians read (Fresh News, DAP, VOD, Phnom Penh Post, etc.)
- THAI SOURCES: Domestic news that Thai civilians read (Thai Rath, Matichon, Bangkok Post, etc.)
- INTERNATIONAL SOURCES: Outside observers (Reuters, AP, BBC, etc.) — NOTE: "International" doesn't mean "neutral". These outlets may have access biases (e.g., easier access to one government's officials) or editorial leanings. Treat them as additional perspectives, not automatic truth.

${memoryContext}

🧠 YOUR ANALYSIS APPROACH:
- You can SEARCH THE WEB to verify claims or find additional context
- Compare how different sources frame the same events
- Identify the KEY THEMES and CONCERNS emphasized by each country's media
- Note where different sources emphasize different aspects
- Apply balanced judgment to differing accounts
- You may reference previous analysis for CONTEXT, but evaluate current news on its own merits. If evidence changes, your analysis should change.

═══════════════════════════════════════════════════════════════
🛡️ BULLETPROOF NEUTRALITY RULES (CRITICAL - READ CAREFULLY)
═══════════════════════════════════════════════════════════════

These rules ensure NO reader from ANY country can accuse you of bias:

📐 RULE 1: SYMMETRIC LANGUAGE
If you use a negative word for one country, you MUST use equally weighted language for the other.
❌ BAD: "Country A's claim is propaganda" vs "Country B's claim is unverified"
   → "Propaganda" = accusation of lying. "Unverified" = neutral uncertainty.
✅ GOOD: "Country A's claim is unverified" AND "Country B's claim is unverified"
✅ ALSO GOOD: "Country A's claim appears exaggerated" AND "Country B's claim appears exaggerated"

📐 RULE 2: ATTRIBUTION MANDATE
NEVER say "verified" or "confirmed" without naming WHO verified it.
❌ BAD: "The verified death toll is 30"
✅ GOOD: "Per Reuters/AP estimates, the death toll is approximately 30"
✅ GOOD: "International monitors (ICRC, UN) report 30-50 casualties"
If you cannot name a verifier, say "reported" not "verified".

📐 RULE 3: CONFIDENCE REFLECTS SOURCE QUALITY
Confidence scores should reflect ACTUAL source quality and information availability — do NOT force artificial parity.
- If one side has better verified coverage (more wire services, more independent reporters), that side CAN have higher confidence
- Large gaps (>15 points) MUST be explained in confidenceRationale
- Hiding genuine information asymmetry IS a form of bias — report reality

📐 RULE 4: PROPORTIONAL CRITICISM (NEUTRAL SECTION)
Criticism should be proportional to actual discrepancies found, NOT forced 50/50 balance.
❌ BAD: Forcing equal criticism when evidence clearly shows one side fabricating more
❌ ALSO BAD: 5 paragraphs criticizing one side, silence on the other
✅ GOOD: If one side has objectively more spin, criticize proportionally BUT explicitly state: "Analysis shows more discrepancies in [Country]'s claims this period."
✅ KEY: No side gets a pass. Even if one side is worse, the other side's issues still get mentioned.

📐 RULE 5: NO EDITORIALIZING ON THIRD PARTIES
Describe what foreign leaders/organizations DID, not whether it was smart.
❌ BAD: "The US announcement was detached from reality"
✅ GOOD: "The US announced X; Country A rejected it, Country B welcomed it"

📐 RULE 6: RANGE OVER PICKING SIDES
When sources give conflicting numbers, report the RANGE, not your favorite.
❌ BAD: "Death toll is 30" (picking the international number)
✅ GOOD: "Death toll disputed: 30-50 per international monitors, 480+ per Country A claims"

📏 FICTIONAL EXAMPLES (to show the PATTERN - these are NOT about Cambodia/Thailand):
Example of SYMMETRIC criticism:
"Country A claims to have killed 500 enemy soldiers; international tallies suggest 40-60. Similarly, Country B claims zero civilian casualties from its shelling, contradicted by NGO reports of 12 civilian deaths. BOTH governments appear to be manipulating figures for domestic audiences."

Example of ATTRIBUTED claims:
"According to Red Cross field reports, approximately 2,000 civilians have fled the border region. Country A's government puts this figure at 10,000; Country B disputes any displacement occurred. The Red Cross figure is considered most reliable due to on-ground presence."

Example of BALANCED referee call:
"The situation reveals classic information warfare from BOTH sides: Country A's state media emphasizes enemy atrocities while minimizing own-side incidents; Country B's coverage does the mirror opposite. Neither domestic narrative can be taken at face value."
═══════════════════════════════════════════════════════════════

⚠️ ADDITIONAL CRITICAL ANALYSIS PRINCIPLES:
- ALL parties in a conflict have incentives to exaggerate successes and minimize losses
- Apply EQUAL skepticism to: (1) Thai government/military, (2) Cambodian government/military, (3) Both domestic media, (4) International media (which may have its own editorial biases)
- NO source type is automatically 'truth' - prioritize claims corroborated by MULTIPLE independent sources regardless of origin
- If sources disagree, NOTE THE DISCREPANCY without assuming either is correct
- BE DIRECT about discrepancies between ANY sources (Thai vs Cambodian, domestic vs international, etc.)
- CALL OUT all sides proportionally when they exaggerate, omit facts, or use nationalist framing — don't force false equivalence, but don't give anyone a free pass either
- DON'T pick sides - acknowledge uncertainty when evidence is conflicting
- CUMULATIVE BIAS CHECK: After drafting, ask yourself: "Did I give one country benefit-of-doubt more often across ALL claims?" If yes, rebalance or explicitly justify why.

📊 ARTICLE COUNT NOTE:
- The number of articles from each country may vary - this is normal and does NOT indicate importance
- Fewer articles from one country does NOT mean less activity or less validity
- Judge each perspective by QUALITY and CONTENT, not by article count
- Give equal analytical weight to all perspectives regardless of how many articles were found

⭐ CREDIBILITY SCORES (cred:XX) - USE THESE!
Each article has a credibility score. Weight your analysis accordingly:
- cred:80-100: HIGHLY RELIABLE - base your analysis primarily on these
- cred:60-79: RELIABLE - solid sources, can trust most claims
- cred:40-59: MIXED - verify claims against higher-cred sources before accepting
- cred:20-39: SKEPTICAL - likely propaganda or unverified, mention with caveats
- cred:0-19: UNRELIABLE - do not use as basis for facts, only note the narrative exists
If high-cred and low-cred articles conflict, TRUST THE HIGH-CRED SOURCE.

${TRANSLATION_STYLE_GUIDE}

═══════════════════════════════════════════════════════════════
🔶 LOW-CREDIBILITY / UNVERIFIED ARTICLES (analyze for spin & framing):
These articles scored lowest on credibility. They may contain TRUE information presented with spin, or outright fabrications. Your job: extract what's real, flag what's exaggerated, note the framing each side uses.

🇰🇭 CAMBODIAN LOW-CRED (${cambodiaLowCred.length} articles):
${cambodiaPropaganda || "(no articles)"}

🇹🇭 THAI LOW-CRED (${thailandLowCred.length} articles):
${thailandPropaganda || "(no articles)"}

🌍 INTERNATIONAL LOW-CRED (${internationalLowCred.length} articles):
${internationalPropaganda || "(no articles)"}

⚡ BREAKING NEWS (${breakingNews.length} most recent articles across all sources):
${breakingNewsList || "(no articles)"}
═══════════════════════════════════════════════════════════════

🎖️ MILITARY POSTURE - SCORING GUIDE:
This gauge measures whether a party is DEFENDING, ESCALATING, or ATTACKING.
The bar position MUST match the posture category.

⚔️ POSTURE & INTENSITY (these MUST match!):
🟢 PEACEFUL (intensity: 0-30): No military threat, normal operations, diplomacy active
   - 0-10: Complete peace, minimal military presence
   - 11-20: Normal patrols, routine operations
   - 21-30: Heightened awareness, but no military action

🟡 DEFENSIVE (intensity: 31-55): Protecting own position, responding to threats
   - 31-40: Reinforcing positions, moving to defensive posture
   - 41-50: Active defense, fortifying against incursion
   - 51-55: Heavy defensive action (returning fire, repelling attack)

🟠 ESCALATED (intensity: 56-69): Mobilizing, posturing, preparing for potential offensive
   - 56-60: Troop buildups, forward deployments, ultimatums issued
   - 61-65: Artillery/assets moved to striking positions
   - 66-69: Imminent attack posture, provocations, cross-border probing

🔴 AGGRESSIVE (intensity: 70-100): Attacking, invading, or initiating combat
   - 70-80: Cross-border strikes, entering contested areas
   - 81-90: Active offensive operations, seizing ground
   - 91-100: Full-scale offensive

⚠️ CRITICAL RULES:
   - If posture is PEACEFUL → intensity must be 0-30
   - If posture is DEFENSIVE → intensity must be 31-55
   - If posture is ESCALATED → intensity must be 56-69
   - If posture is AGGRESSIVE → intensity must be 70-100
   - BOTH-SIDES RULE: Both parties CAN have the same posture. Assign intensity based on scale/severity of each side's actions independently.

🏷️ POSTURE LABEL - MUST BE SHORT (MAX 6 WORDS):
Examples by posture:
  PEACEFUL: "Routine Patrols", "Normal Operations", "Diplomatic Talks"
  DEFENSIVE: "Border Reinforcement", "Defensive Positions", "Repelling Attack"
  ESCALATED: "Troop Mobilization", "Forces Massing", "Preparing Offensive"
  AGGRESSIVE: "Cross-Border Strike", "Territory Seizure", "Offensive Underway"

💡 ACTION-BASED ASSESSMENT (focus on WHAT parties DO, not territorial claims):
- WHO MOVED FORWARD this cycle? → Moving toward the other side = more aggressive
- WHO FIRED FIRST in engagements? → Initiating fire = more aggressive
- WHO IS STATIONARY vs ADVANCING? → Holding position = more defensive
- SCALE OF OPERATIONS: Airstrikes/artillery > ground incursions > defensive fire
- If both sides claim self-defense, focus on WHO INITIATED the specific engagement being analyzed

🛡️ VERIFICATION & ACCURACY RULES:
1. NO SPECIFICITY WITHOUT SOURCE: Do NOT invent specific names (e.g., specific hill numbers, bridge names, or unit IDs) unless EXPLICITLY present in the source text. Use general terms like "high ground" or "infrastructure" if unsure.
2. PRECISE LANGUAGE: Distinguish between "rejecting a PROPOSAL" vs "rejecting a CLAIM". If a source says "We deny X happened", report it as a DENIAL, not a refusal of peace.
3. PLATFORM VERIFICATION: Do not specify weapon platforms (e.g., "Naval shelling", "F-16s") unless high-credibility sources confirm them. Use "airstrikes" or "shelling" if the specific platform is unconfirmed.
4. POLICY VS REALITY: Distinguish between official policy (e.g., "border closed by decree") and tactical reality (e.g., "crossing impassable due to fighting").

📰 KEY EVENTS STYLE GUIDE - SMART SPACE MANAGEMENT:
Write KEY EVENTS as SHORT headline-style bullets. MAX 12 WORDS each!

⚖️ BALANCE SUMMARY LENGTH vs. NUMBER OF POINTS:
The neutral card has LIMITED TOTAL SPACE. You must balance these two elements:
- **If your summary is LONG (70+ words)**: Use FEWER key events (2-3 points max)
- **If your summary is SHORT (50-60 words)**: You can use MORE key events (4-5 points)
- **Think total card density**: Long text + many bullets = overload. Keep it scannable!

❌ TOO LONG: "Country A announces 'Ceasefire', but fighting intensifies hours later as Country B rejects the truce"
❌ TOO LONG: "Humanitarian Crisis: 330,000+ civilians displaced as borders close"
✅ GOOD: "Ceasefire collapses hours after announcement"
✅ GOOD: "Airstrikes hit key bridge; rockets fired in response"
✅ GOOD: "330,000+ civilians displaced; borders closed"
✅ GOOD: "Both sides claim self-defense at UN"

Be CONCISE. Each event = 1 short line. No multi-clause sentences. Frame events NEUTRALLY - don't imply who "started it" unless clearly established.

📏 LENGTH HIERARCHY (IMPORTANT!):
- SIDE CARDS (Cambodia/Thailand): COMPACT. 2-3 sentences, max 50 words. These cards have limited space. Report key claims CONCISELY - just the essence of what their media is saying.
- CENTER CARD (Neutral): LONGEST but BOUNDED. 3-5 sentences, 50-80 words for summary. You are the REFEREE here - summarize BOTH sides' actions, call out discrepancies, give the full picture. Remember to balance with key events!

ANALYZE ALL PERSPECTIVES. Return EXACTLY one fenced \`\`\`json code block and NOTHING else:
\`\`\`json
{
  "cambodia": {
    "officialNarrative": "English (2-3 sentences, max 50 words). Key claims from Cambodian media only.",
    "officialNarrativeTh": "Thai local wording in THAI SCRIPT ONLY (2 short sentences, plain everyday words)",
    "officialNarrativeKh": "Khmer local wording in KHMER SCRIPT ONLY (2 short sentences, plain everyday words)",
    "narrativeSource": "Primary source(s)",
    "militaryIntensity": 50,
    "militaryPosture": "PEACEFUL|DEFENSIVE|ESCALATED|AGGRESSIVE",
    "postureLabel": "Short phrase (max 4 words)",
    "postureLabelTh": "Thai plain label in THAI SCRIPT ONLY (max 4 words)",
    "postureLabelKh": "Khmer plain label in KHMER SCRIPT ONLY (max 4 words)",
    "postureRationale": "English 1-2 sentences. WHY this posture? Focus on actions, not sources.",
    "postureRationaleTh": "Thai local wording in THAI SCRIPT ONLY (1-2 short sentences; explain jargon simply)",
    "postureRationaleKh": "Khmer local wording in KHMER SCRIPT ONLY (1-2 short sentences; explain jargon simply)",
    "biasNotes": "Key themes emphasized",
    "confidence": 75,
    "confidenceRationale": "Brief justification"
  },
  "thailand": {
    "officialNarrative": "English (2-3 sentences, max 50 words). Key claims from Thai media only.",
    "officialNarrativeTh": "Thai local wording in THAI SCRIPT ONLY (2 short sentences, plain everyday words)",
    "officialNarrativeKh": "Khmer local wording in KHMER SCRIPT ONLY (2 short sentences, plain everyday words)",
    "narrativeSource": "Primary source(s)",
    "militaryIntensity": 50,
    "militaryPosture": "PEACEFUL|DEFENSIVE|ESCALATED|AGGRESSIVE",
    "postureLabel": "Short phrase (max 4 words)",
    "postureLabelTh": "Thai plain label in THAI SCRIPT ONLY (max 4 words)",
    "postureLabelKh": "Khmer plain label in KHMER SCRIPT ONLY (max 4 words)",
    "postureRationale": "English 1-2 sentences. WHY this posture? Focus on actions, not sources.",
    "postureRationaleTh": "Thai local wording in THAI SCRIPT ONLY (1-2 short sentences; explain jargon simply)",
    "postureRationaleKh": "Khmer local wording in KHMER SCRIPT ONLY (1-2 short sentences; explain jargon simply)",
    "biasNotes": "Key themes emphasized",
    "confidence": 75,
    "confidenceRationale": "Brief justification"
  },
  "neutral": {
    "generalSummary": "English (3-5 sentences, 50-80 words). Summarize BOTH sides' key actions, humanitarian impact, diplomatic developments. Compare claims. Note where sources agree/disagree. Be the impartial commentator giving the full picture.",
    "generalSummaryTh": "Thai local summary in THAI SCRIPT ONLY (3-5 short sentences, plain everyday words, explain hard terms)",
    "generalSummaryKh": "Khmer local summary in KHMER SCRIPT ONLY (3-5 short sentences, plain everyday words, explain hard terms)",
    "conflictLevel": "Low|Elevated|Critical|Uncertain",
    "keyEvents": [
      "2-5 SHORT English headlines (adjust based on summary length!)",
      "MAX 12 words each - use NEUTRAL framing",
      "If summary is 70+ words, use only 2-3 events",
      "If summary is 50-60 words, can use 4-5 events"
    ],
    "keyEventsTh": ["หัวข้อสั้นๆ ในภาษาไทย (THAI SCRIPT ONLY) ไม่เกิน 12 คำ"],
    "keyEventsKh": ["ចំណងជើងខ្លី ជាភាសាខ្មែរ (KHMER SCRIPT ONLY) មិនលើស 12 ពាក្យ"],
    "discrepancies": "List SPECIFIC contradictions. Use SYMMETRIC language: 'Country A claims X, Country B claims Y, international sources suggest Z'. ATTRIBUTE the 'believable' version to a NAMED source (Reuters, ICRC, etc), don't just pick one.",
    "confidence": 75,
    "confidenceRationale": "Must justify if Cambodia/Thailand confidence differs by >10 points. What's verified? What's propaganda from EACH side?"
  },
  "scheduling": {
    "nextCycleHours": 12,
    "reason": "Brief 1-sentence explanation. Example: 'Peaceful conditions, both sides defensive, no major developments'"
  },
  "dashboard": {
    "conflictLevel": "LOW|ELEVATED|CRITICAL|UNCERTAIN",
    "casualtyCount": 0,
    "displacedCount": 0,
    "civilianInjuredCount": 0,
    "militaryInjuredCount": 0,
    "unchanged": true,
    "changeReason": "Brief explanation of why stats changed or stayed same"
  }
}
\`\`\`

📊 DASHBOARD STATS RULES (in the "dashboard" section):
These are the LIVE STATS shown on the dashboard. Be CONSERVATIVE - only change if you have NEW verified evidence.

CONFLICT LEVEL:
- "LOW": No kinetic action, only diplomatic words
- "ELEVATED": Troop movements, drills, minor skirmishes, small-scale evacuations
- "CRITICAL": Sustained shelling, confirmed fatalities, major offensive
- "UNCERTAIN": Conflicting reports, cannot determine with confidence

STATS RULES:
- casualtyCount: CUMULATIVE fatalities - can only increase, never decrease
- displacedCount: Current number of displaced civilians
- civilianInjuredCount: Separate civilian injuries
- militaryInjuredCount: Separate military injuries
- unchanged: true if you're keeping previous values (this is GOOD if nothing changed)
- changeReason: Explain why you changed or kept the values

PREVIOUS DASHBOARD VALUES (keep these if no new verified evidence):
- Conflict Level: ${prevNeutral?.conflictLevel || "LOW"}
- Casualties: ${prevStats?.casualtyCount ?? 0}
- Displaced: ${prevStats?.displacedCount ?? 0}
- Civilian Injured: ${prevStats?.civilianInjuredCount ?? 0}
- Military Injured: ${prevStats?.militaryInjuredCount ?? 0}

If timeline shows no new casualties/displacement events, KEEP THE SAME NUMBERS.

RULES:
- Return EXACTLY one fenced \`\`\`json code block and NOTHING else
- Inside the fence, output valid JSON only
- Use English numerals (0-9) only

🔍 MANDATORY SELF-CHECK (DO THIS BEFORE OUTPUTTING):
1. SYMMETRIC LANGUAGE: Count negative words for each country in neutral section - roughly proportional to actual discrepancies found?
2. ATTRIBUTION: Every "verified/confirmed" claim has a NAMED source (Reuters, ICRC, etc)?
3. CONFIDENCE PARITY: Cambodia/Thailand confidence within 10 points, OR gap justified in rationale?
4. INTENSITY COHERENCE: If one is AGGRESSIVE and other is DEFENSIVE, is the intensity gap ≥20 points? If both AGGRESSIVE, are intensities proportional to actions?
5. NO EDITORIAL: No adjectives for third parties (Trump, UN) - only describe what they DID?
6. CUMULATIVE BIAS: Across ALL claims, did you give one country benefit-of-doubt more often? If so, explicitly note it or rebalance.
7. FOG OF WAR: If information is genuinely unclear/conflicting, say so. "Insufficient verified information" is a valid answer.

📅 ADAPTIVE SCHEDULING DECISION:
Decide when the next intelligence cycle should run. Pick any value between 4 and 48 hours. If the border is quiet and news is just repeating itself, don't be afraid to "sleep on it" for 24-48 hours. We don't need to burn cycles on stale news. 

However, if bullets are flying or troops are moving, stay on top of it with a 4-8h window.

THINK LIKE THIS:
- "Is something actually moving?" -> 4-12 hours.
- "Same old posturing/patrols?" -> 18-24 hours.
- "Dead silence/Peace talks?" -> 36-48 hours.

Return your hours and a brief reason in the "scheduling" section.`;

        try {
            // Use generic self-healing helper
            const result = await callGeminiStudioWithSelfHealing<{
                cambodia: any;
                thailand: any;
                neutral: any;
                scheduling?: { nextCycleHours: number; reason: string };
                dashboard?: {
                    conflictLevel?: string;
                    casualtyCount?: number;
                    displacedCount?: number;
                    civilianInjuredCount?: number;
                    militaryInjuredCount?: number;
                    unchanged?: boolean;
                    changeReason?: string;
                };
            }>(prompt, "synthesis", 2, "SYNTHESIS");

            if (!result) {
                console.warn("[SYNTHESIS] skipped reason=invalid_or_missing_json preservedExisting=true");
                // Return null to indicate failure, but existing analysis tables remain untouched
                // This is intentional: we never overwrite good data with nothing
                return null;
            }

            const writeErrors: string[] = [];
            const validPostures = ["PEACEFUL", "DEFENSIVE", "ESCALATED", "AGGRESSIVE"] as const;
            const validTerritories = ["OWN_TERRITORY", "DISPUTED_ZONE", "FOREIGN_TERRITORY", "BORDER_ZONE"] as const;
            const validConflictLevels = ["LOW", "ELEVATED", "CRITICAL", "UNCERTAIN"] as const;

            const normalizePosture = (raw: unknown): (typeof validPostures)[number] => {
                if (typeof raw !== "string") return "DEFENSIVE";
                const upper = raw.toUpperCase() as (typeof validPostures)[number];
                return validPostures.includes(upper) ? upper : "DEFENSIVE";
            };

            const normalizeTerritory = (raw: unknown): (typeof validTerritories)[number] | undefined => {
                if (typeof raw !== "string") return undefined;
                const upper = raw.toUpperCase() as (typeof validTerritories)[number];
                return validTerritories.includes(upper) ? upper : undefined;
            };

            const clampIntensity = (posture: (typeof validPostures)[number], raw: unknown): number => {
                const value = typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
                if (posture === "PEACEFUL") return Math.max(0, Math.min(30, value ?? 15));
                if (posture === "DEFENSIVE") return Math.max(31, Math.min(55, value ?? 45));
                if (posture === "ESCALATED") return Math.max(56, Math.min(69, value ?? 62));
                return Math.max(70, Math.min(100, value ?? 80));
            };

            const normalizeConflictLevel = (raw: unknown): (typeof validConflictLevels)[number] => {
                if (typeof raw !== "string") return "LOW";
                const upper = raw.toUpperCase() as (typeof validConflictLevels)[number];
                return validConflictLevels.includes(upper) ? upper : "LOW";
            };

            const normalizeNonNegativeInt = (raw: unknown, fallback: number): number => {
                if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
                return Math.max(0, Math.round(raw));
            };

            let dashboardUpdated = false;
            let cambodiaSummary = "missing";
            let thailandSummary = "missing";
            let neutralSummary = "missing";
            let dashboardSummary = "missing";
            let snapshotPublished = false;

            // Save Cambodia analysis
            if (result.cambodia) {
                try {
                    const posture = normalizePosture(result.cambodia.militaryPosture);
                    const territory = normalizeTerritory(result.cambodia.territorialContext);
                    const intensity = clampIntensity(posture, result.cambodia.militaryIntensity);

                    await ctx.runMutation(internal.api.upsertAnalysis, {
                        target: "cambodia",
                        officialNarrative: result.cambodia.officialNarrative || "No narrative available.",
                        officialNarrativeEn: result.cambodia.officialNarrativeEn,
                        officialNarrativeTh: result.cambodia.officialNarrativeTh,
                        officialNarrativeKh: result.cambodia.officialNarrativeKh,
                        narrativeSource: result.cambodia.narrativeSource || "Unknown",
                        militaryIntensity: intensity,
                        militaryPosture: posture,
                        postureLabel: result.cambodia.postureLabel || result.cambodia.postureLabelEn,
                        postureLabelEn: result.cambodia.postureLabelEn || result.cambodia.postureLabel,
                        postureLabelTh: result.cambodia.postureLabelTh,
                        postureLabelKh: result.cambodia.postureLabelKh,
                        postureRationale: result.cambodia.postureRationale || result.cambodia.postureRationaleEn,
                        postureRationaleEn: result.cambodia.postureRationaleEn || result.cambodia.postureRationale,
                        postureRationaleTh: result.cambodia.postureRationaleTh,
                        postureRationaleKh: result.cambodia.postureRationaleKh,
                        territorialContext: territory,
                    });
                    cambodiaSummary = `${posture}/${intensity}${territory ? `/${territory}` : ""}`;
                } catch (error) {
                    const message = `Cambodia analysis upsert failed: ${String(error)}`;
                    writeErrors.push(message);
                    console.error(`[SYNTHESIS] ${message}`);
                }
            }

            // Save Thailand analysis
            if (result.thailand) {
                try {
                    const posture = normalizePosture(result.thailand.militaryPosture);
                    const territory = normalizeTerritory(result.thailand.territorialContext);
                    const intensity = clampIntensity(posture, result.thailand.militaryIntensity);

                    await ctx.runMutation(internal.api.upsertAnalysis, {
                        target: "thailand",
                        officialNarrative: result.thailand.officialNarrative || "No narrative available.",
                        officialNarrativeEn: result.thailand.officialNarrativeEn,
                        officialNarrativeTh: result.thailand.officialNarrativeTh,
                        officialNarrativeKh: result.thailand.officialNarrativeKh,
                        narrativeSource: result.thailand.narrativeSource || "Unknown",
                        militaryIntensity: intensity,
                        militaryPosture: posture,
                        postureLabel: result.thailand.postureLabel || result.thailand.postureLabelEn,
                        postureLabelEn: result.thailand.postureLabelEn || result.thailand.postureLabel,
                        postureLabelTh: result.thailand.postureLabelTh,
                        postureLabelKh: result.thailand.postureLabelKh,
                        postureRationale: result.thailand.postureRationale || result.thailand.postureRationaleEn,
                        postureRationaleEn: result.thailand.postureRationaleEn || result.thailand.postureRationale,
                        postureRationaleTh: result.thailand.postureRationaleTh,
                        postureRationaleKh: result.thailand.postureRationaleKh,
                        territorialContext: territory,
                    });
                    thailandSummary = `${posture}/${intensity}${territory ? `/${territory}` : ""}`;
                } catch (error) {
                    const message = `Thailand analysis upsert failed: ${String(error)}`;
                    writeErrors.push(message);
                    console.error(`[SYNTHESIS] ${message}`);
                }
            }

            // Save Neutral analysis (narrative + key events)
            if (result.neutral) {
                try {
                    await ctx.runMutation(internal.api.upsertAnalysis, {
                        target: "neutral",
                        generalSummary: result.neutral.generalSummary || "No data.",
                        generalSummaryEn: result.neutral.generalSummaryEn,
                        generalSummaryTh: result.neutral.generalSummaryTh,
                        generalSummaryKh: result.neutral.generalSummaryKh,
                        conflictLevel: result.neutral.conflictLevel || "Low",
                        keyEvents: result.neutral.keyEvents || [],
                        keyEventsEn: result.neutral.keyEventsEn,
                        keyEventsTh: result.neutral.keyEventsTh,
                        keyEventsKh: result.neutral.keyEventsKh,
                    });
                    neutralSummary = `${result.neutral.conflictLevel || "Low"}/events:${result.neutral.keyEvents?.length || 0}`;
                } catch (error) {
                    const message = `Neutral analysis upsert failed: ${String(error)}`;
                    writeErrors.push(message);
                    console.error(`[SYNTHESIS] ${message}`);
                }
            }

            // Save Dashboard Stats (merged from updateDashboard)
            const dashboard = result.dashboard || {};
            if (!result.dashboard) {
                console.warn("[DASHBOARD] response_missing_dashboard_section usingPreviousStats=true");
            }

            try {
                const conflictLevel = normalizeConflictLevel(dashboard.conflictLevel || result.neutral?.conflictLevel || prevStats?.conflictLevel || "LOW");
                const displacedCount = normalizeNonNegativeInt(dashboard.displacedCount, prevStats?.displacedCount ?? 0);
                const casualtyCount = normalizeNonNegativeInt(dashboard.casualtyCount, prevStats?.casualtyCount ?? 0);
                const civilianInjuredCount = normalizeNonNegativeInt(dashboard.civilianInjuredCount, prevStats?.civilianInjuredCount ?? 0);
                const militaryInjuredCount = normalizeNonNegativeInt(dashboard.militaryInjuredCount, prevStats?.militaryInjuredCount ?? 0);

                await ctx.runMutation(internal.api.upsertDashboardStats, {
                    conflictLevel,
                    displacedCount,
                    displacedTrend: prevStats?.displacedTrend ?? 0,
                    casualtyCount,
                    civilianInjuredCount,
                    militaryInjuredCount,
                });
                dashboardUpdated = true;
                dashboardSummary = `${conflictLevel}/casualties:${casualtyCount}/displaced:${displacedCount}/civilianInjured:${civilianInjuredCount}/militaryInjured:${militaryInjuredCount}`;
            } catch (error) {
                const message = `Dashboard upsert failed: ${String(error)}`;
                writeErrors.push(message);
                console.error(`[SYNTHESIS] ${message}`);
            }

            try {
                await ctx.runMutation(internal.api.publishDashboardSnapshot, {});
                snapshotPublished = true;
            } catch (error) {
                const message = `Dashboard snapshot publish failed: ${String(error)}`;
                writeErrors.push(message);
                console.error(`[SYNTHESIS] ${message}`);
            }

            if (writeErrors.length > 0) {
                console.warn(`[SYNTHESIS] write_issues count=${writeErrors.length}`);
            }

            console.log(`[SYNTHESIS] wrote cambodia=${cambodiaSummary} thailand=${thailandSummary} neutral=${neutralSummary} dashboard=${dashboardSummary} snapshot=${snapshotPublished} writeErrors=${writeErrors.length}`);

            return {
                ...result,
                writeErrors,
                dashboardUpdated,
            };
        } catch (error) {
            console.error("[SYNTHESIS] failed", error);
            return null;
        }
    },
});

// =============================================================================
// STEP 3: DATABASE MANAGER
// A dedicated AI agent that verifies, updates, and maintains article quality
// COMPLETELY SEPARATE from curators - curators find, manager verifies
// =============================================================================

export const manageDatabase = internalAction({
    args: {},
    handler: async (ctx): Promise<{ reviewed: number; updated: number; archived: number }> => {
        console.log("📋 [MANAGER] Running comprehensive database review...");

        // Get ALL articles from all 3 news tables
        const cambodiaArticles: any[] = await ctx.runQuery(internal.api.getNewsInternal, { country: "cambodia", limit: 100 });
        const thailandArticles: any[] = await ctx.runQuery(internal.api.getNewsInternal, { country: "thailand", limit: 100 });
        const internationalArticles: any[] = await ctx.runQuery(internal.api.getNewsInternal, { country: "international", limit: 100 });

        const allArticles = [
            ...cambodiaArticles.map(a => ({ ...a, country: "cambodia" as const })),
            ...thailandArticles.map(a => ({ ...a, country: "thailand" as const })),
            ...internationalArticles.map(a => ({ ...a, country: "international" as const }))
        ];

        if (allArticles.length === 0) {
            console.log("⚠️ [MANAGER] No articles to manage");
            return { reviewed: 0, updated: 0, archived: 0 };
        }

        // Build detailed list for AI review
        const articlesList: string = allArticles.map((a: any, i: number) => {
            const ageInDays = Math.floor((Date.now() - (a.publishedAt || a.fetchedAt)) / (1000 * 60 * 60 * 24));
            return `${i + 1}.[${a.country.toUpperCase()}] "${a.title}"
Source: ${a.source} | Category: ${a.category}
Published: ${ageInDays} days ago | Current Credibility: ${a.credibility || 50}/100
URL: ${a.sourceUrl || "none"}
Summary: ${a.summary || "none"} `;
        }).join("\n\n");

        const prompt: string = `You are a DATABASE MANAGER and FACT-CHECKER for a news intelligence system.
You have access to WEB SEARCH - USE IT to verify claims!

🔍 YOUR VERIFICATION TASKS:
1. SEARCH THE WEB to verify each article is real (check if URL exists, source is credible)
2. CROSS-REFERENCE: If multiple articles report the same event, do they agree? Note discrepancies.
3. CHECK FOR DUPLICATES: Same story from multiple sources (flag duplicates)
4. VERIFY SOURCES: Is the domain a real news outlet? Is the URL format valid?
5. FACT-CHECK: Do claims match other reporting? Flag contradictions.

📋 CURRENT DATABASE (${allArticles.length} articles):
${articlesList}

🔬 VERIFICATION CHECKLIST FOR EACH ARTICLE:
- URL looks valid (proper domain, not gibberish)
- Source is a known news outlet (not random blog)
- Headline isn't sensationalized clickbait
- Search web to confirm event actually happened
- Check if newer articles contradict this one
- Look for duplicate stories from other sources

📊 CREDIBILITY ADJUSTMENT RULES:
• INCREASE if: Verified by web search, multiple sources confirm, reputable outlet
• DECREASE if: Can't verify, URL looks fake, source unknown, contradicted by others
• MARK FALSE if: Proven misinformation, fabricated quotes, event didn't happen
• MARK OUTDATED if: Situation has changed significantly since publication
• MARK DUPLICATE if: Same story already exists from another source

RETURN YOUR ANALYSIS as EXACTLY one fenced \`\`\`json code block:
\`\`\`json
{
  "actions": [
    {
      "index": 1,
      "action": "update_credibility|mark_false|mark_outdated|mark_unverified|archive|mark_duplicate|keep",
      "newCredibility": 75,
      "reason": "Brief explanation + what you found in web search",
      "duplicateOf": "(if duplicate) Title of original article"
    }
  ],
  "crossReferenceNotes": "Notes on how articles relate to each other",
  "summary": "Overall: X verified, Y suspicious, Z duplicates"
}
\`\`\`

ACTIONS:
- update_credibility: Adjust 0-100 score (EXPLAIN why)
- mark_false: PROVEN misinformation (requires evidence)
- mark_outdated: Events no longer current
- mark_unverified: Cannot confirm, suspicious URL
- mark_duplicate: Same story from different source
- archive: Old article (>30 days) no longer relevant
- keep: Verified and fine as-is

RULES:
- Return EXACTLY one fenced \`\`\`json code block and NOTHING else
- Inside the fence, output valid JSON only
- Use English numerals (0-9) only`;

        try {
            // Use generic self-healing helper
            const result = await callGeminiStudioWithSelfHealing<{
                actions: any[];
                crossReferenceNotes?: string;
                summary?: string;
            }>(prompt, "verification", 2, "MANAGER");

            if (!result) {
                console.log("❌ [MANAGER] Invalid or missing JSON response from API");
                console.log("ℹ️ [MANAGER] No changes will be made this cycle - all articles preserved");
                return { reviewed: allArticles.length, updated: 0, archived: 0 };
            }

            let updatedCount = 0;
            let archivedCount = 0;

            for (const action of result.actions || []) {
                const articleIndex = action.index - 1;
                if (articleIndex < 0 || articleIndex >= allArticles.length) continue;

                const article = allArticles[articleIndex];

                switch (action.action) {
                    case "update_credibility":
                        if (action.newCredibility !== undefined) {
                            await ctx.runMutation(internal.api.updateArticleCredibility, {
                                country: article.country,
                                title: article.title,
                                credibility: Math.max(0, Math.min(100, action.newCredibility)),
                            });
                            console.log(`   📊 Updated credibility: "${article.title}" → ${action.newCredibility} `);
                            updatedCount++;
                        }
                        break;

                    case "mark_false":
                        await ctx.runMutation(internal.api.flagArticle, {
                            country: article.country,
                            title: article.title,
                            status: "false",
                        });
                        console.log(`   🚫 Marked FALSE: "${article.title}"(${action.reason})`);
                        updatedCount++;
                        break;

                    case "mark_outdated":
                        await ctx.runMutation(internal.api.flagArticle, {
                            country: article.country,
                            title: article.title,
                            status: "outdated",
                        });
                        console.log(`   ⏰ Marked OUTDATED: "${article.title}"`);
                        updatedCount++;
                        break;

                    case "mark_unverified":
                        await ctx.runMutation(internal.api.flagArticle, {
                            country: article.country,
                            title: article.title,
                            status: "unverified",
                        });
                        console.log(`   ❓ Marked UNVERIFIED: "${article.title}"`);
                        updatedCount++;
                        break;

                    case "archive":
                        await ctx.runMutation(internal.api.flagArticle, {
                            country: article.country,
                            title: article.title,
                            status: "archived",
                        });
                        console.log(`   📦 ARCHIVED: "${article.title}"`);
                        archivedCount++;
                        break;

                    case "mark_duplicate":
                        // Mark as archived (duplicate of another article)
                        await ctx.runMutation(internal.api.flagArticle, {
                            country: article.country,
                            title: article.title,
                            status: "archived",
                        });
                        console.log(`   🔄 DUPLICATE: "${article.title}"(duplicate of: ${action.duplicateOf || "unknown"})`);
                        archivedCount++;
                        break;

                    case "keep":
                        // Article verified, no changes needed
                        console.log(`   ✓ Verified: "${article.title.substring(0, 50)}..."`);
                        break;
                }
            }

            console.log(`\n✅[MANAGER] Reviewed ${allArticles.length}, updated ${updatedCount}, archived ${archivedCount} `);
            if (result.crossReferenceNotes) {
                console.log(`   📝 Cross - reference notes: ${result.crossReferenceNotes} `);
            }
            if (result.summary) {
                console.log(`   📊 Summary: ${result.summary} `);
            }

            return { reviewed: allArticles.length, updated: updatedCount, archived: archivedCount };
        } catch (error) {
            console.error("❌ [MANAGER] Error:", error);
            return { reviewed: allArticles.length, updated: 0, archived: 0 };
        }
    },
});

// =============================================================================
// ORCHESTRATOR - CHAINED ACTIONS (Each step gets its own 10-min timer)
// =============================================================================

// Step 1: Curation - Fetches news from all sources
export const runResearchCycle = internalAction({
    args: { attempt: v.optional(v.number()) },
    handler: async (ctx, { attempt = 0 }) => {
        // ═══ DEDUPLICATION: Acquire lock to prevent overlapping runs ═══
        const runId = crypto.randomUUID();
        const lockResult = await ctx.runMutation(internal.api.acquireCycleLock, { runId });

        if (!lockResult.acquired) {
            console.warn(`[CYCLE] skipped reason=lock_not_acquired detail=${lockResult.reason}`);
            return;
        }

        // Check if we should skip this cycle (one-time skip, auto-resets)
        const stats = await ctx.runQuery(internal.api.getSystemStatsInternal, {});
        if (stats?.skipNextCycle) {
            console.log("[CYCLE] skipped reason=skipNextCycle");
            await ctx.runMutation(internal.api.setStatus, { status: "online" });
            await ctx.runMutation(internal.api.clearSkipNextCycle, {});
            await ctx.runMutation(internal.api.releaseCycleLock, { runId }); // Release lock when skipping
            return;
        }

        console.log(`[CYCLE] started runId=${runId} mode=chained attempt=${attempt}`);

        await ctx.runMutation(internal.api.setStatus, { status: "syncing" });

        const errors: string[] = [];
        let cambodiaResult: { newArticles: number; flagged: number; error?: string } | null = null;
        let thailandResult: { newArticles: number; flagged: number; error?: string } | null = null;
        let internationalResult: { newArticles: number; flagged: number; error?: string } | null = null;
        const curationSummary = (result: { newArticles: number; flagged: number; error?: string } | null) =>
            result ? `${result.newArticles}new/${result.flagged}flagged` : "failed";

        // ── STEP 1: NEWS CURATION ──
        try {
            cambodiaResult = await runWithRetries(
                "[STEP 1] Cambodia curation",
                () => ctx.runAction(internal.research.curateCambodia, {}),
            );
            await sleep(2000);
        } catch (e) {
            console.error("[STEP 1] cambodia_curation_failed", e);
            errors.push(`Cambodia: ${summarizeError(e)}`);
        }

        try {
            thailandResult = await runWithRetries(
                "[STEP 1] Thailand curation",
                () => ctx.runAction(internal.research.curateThailand, {}),
            );
            await sleep(2000);
        } catch (e) {
            console.error("[STEP 1] thailand_curation_failed", e);
            errors.push(`Thailand: ${summarizeError(e)}`);
        }

        try {
            internationalResult = await runWithRetries(
                "[STEP 1] International curation",
                () => ctx.runAction(internal.research.curateInternational, {}),
            );
            await sleep(2000);
        } catch (e) {
            console.error("[STEP 1] international_curation_failed", e);
            errors.push(`International: ${summarizeError(e)}`);
        }

        console.log(`[STEP 1] complete cambodia=${curationSummary(cambodiaResult)} thailand=${curationSummary(thailandResult)} international=${curationSummary(internationalResult)} errors=${errors.length}`);

        // If all curation failed, abort the chain
        if (errors.length >= 3) {
            console.error("[STEP 1] all_curation_failed aborting=true");
            const scheduledRetry = await scheduleStepRetry(ctx, {
                stepName: "STEP 1",
                actionReference: internal.research.runResearchCycle,
                args: {},
                attempt,
            });
            await ctx.runMutation(internal.api.setStatus, {
                status: scheduledRetry ? "online" : "error",
                errorLog: scheduledRetry
                    ? "Curation failed completely; retry scheduled with backoff"
                    : "Curation failed completely",
            });
            await ctx.runMutation(internal.api.releaseCycleLock, { runId });
            return;
        }

        // Chain to Step 2 (runs immediately with fresh 10-min timer)
        try {
            await scheduleRunAfterWithRetries(ctx, "Step 2", 0, internal.research.step2_verification, {
                errors,
                runId,
                attempt: 0,
            });
        } catch (e) {
            console.error("[STEP 1] Failed to schedule Step 2:", e);
            const scheduledRetry = await scheduleStepRetry(ctx, {
                stepName: "STEP 1",
                actionReference: internal.research.runResearchCycle,
                args: {},
                attempt,
            });
            await ctx.runMutation(internal.api.setStatus, {
                status: scheduledRetry ? "online" : "error",
                errorLog: scheduledRetry
                    ? `Step 1 handoff failed; retry scheduled. ${summarizeError(e)}`
                    : `Step 1 handoff failed: ${summarizeError(e)}`,
            });
            await ctx.runMutation(internal.api.releaseCycleLock, { runId });
        }
    },
});

// Step 2: Source Verification
export const step2_verification = internalAction({
    args: { errors: v.array(v.string()), runId: v.string(), attempt: v.optional(v.number()) },
    handler: async (ctx, { errors, runId, attempt = 0 }) => {
        const stats = await ctx.runQuery(internal.api.getSystemStatsInternal, {});
        if (stats?.isPaused || stats?.systemStatus === "stopped") {
            console.log("[STEP 2] Aborting step2_verification because system is paused/stopped.");
            await ctx.runMutation(internal.api.releaseCycleLock, { runId });
            return;
        }
        const stepErrors = [...errors];
        let verificationSummary = "not_run";

        try {
            const verifyResult = await runWithRetries(
                "[STEP 2] Source verification",
                () => ctx.runAction(internal.research.verifyAllSources, {}),
            );
            verificationSummary = `verified=${verifyResult.verified} updated=${verifyResult.updated} deleted=${verifyResult.deleted} errors=${verifyResult.errors}`;
        } catch (e) {
            verificationSummary = "failed";
            console.error("[STEP 2] source_verification_failed", e);
            const scheduledRetry = await scheduleStepRetry(ctx, {
                stepName: "STEP 2",
                actionReference: internal.research.step2_verification,
                args: { errors: stepErrors, runId },
                attempt,
            });
            if (scheduledRetry) return;
            stepErrors.push(`Verification: ${summarizeError(e)}`);
            console.warn("[STEP 2] Retry budget exhausted - continuing to historian with accumulated errors");
        }

        console.log(`[STEP 2] complete ${verificationSummary} accumulatedErrors=${stepErrors.length}`);

        // Chain to Step 3 (fresh 10-min timer)
        try {
            await scheduleRunAfterWithRetries(ctx, "Step 3", 0, internal.research.step3_historian, {
                errors: stepErrors,
                runId,
                attempt: 0,
            });
        } catch (e) {
            console.error("[STEP 2] Failed to schedule Step 3:", e);
            const scheduledRetry = await scheduleStepRetry(ctx, {
                stepName: "STEP 2",
                actionReference: internal.research.step2_verification,
                args: { errors: stepErrors, runId },
                attempt,
            });
            if (scheduledRetry) return;

            await ctx.runMutation(internal.api.setStatus, {
                status: "online",
                errorLog: `Step 2 handoff failed after retries: ${summarizeError(e)}`.substring(0, 1900),
            });
            await ctx.runMutation(internal.api.releaseCycleLock, { runId });
        }
    },
});

// Step 3: Historian Loop - Now has full 10 mins for processing articles
export const step3_historian = internalAction({
    args: { errors: v.array(v.string()), runId: v.string(), attempt: v.optional(v.number()) },
    handler: async (ctx, { errors, runId, attempt = 0 }) => {
        const stats = await ctx.runQuery(internal.api.getSystemStatsInternal, {});
        if (stats?.isPaused || stats?.systemStatus === "stopped") {
            console.log("[STEP 3] Aborting step3_historian because system is paused/stopped.");
            await ctx.runMutation(internal.api.releaseCycleLock, { runId });
            return;
        }
        const stepErrors = [...errors];

        // With chaining, we now have full 10 mins for historian
        const startTime = Date.now();
        const MAX_RUNTIME_MS = 10 * 60 * 1000; // 10 mins (max utilization)
        const getTimeRemaining = () => MAX_RUNTIME_MS - (Date.now() - startTime);

        let historianLoops = 0;
        const MAX_HISTORIAN_LOOPS = 10; // User requested limit
        let historianStopReason = "complete";
        let historianProcessed = 0;
        let historianEventsCreated = 0;
        let historianEventsUpdated = 0;
        let historianEventsDeleted = 0;
        let historianSourcesMerged = 0;
        let historianArchived = 0;
        let historianDiscarded = 0;
        let historianCredibilityUpdated = 0;

        let cachedNewsContext: any = null;
        try {
            // Cache the news context once, but keep it inside the guarded retry path so
            // transient Convex query failures do not bypass step-level retries/finalization.
            cachedNewsContext = await runWithRetries(
                "[STEP 3] Historian news context",
                () => ctx.runQuery(internal.api.getRecentNewsContextForHistorian, {}),
            );

            while (historianLoops < MAX_HISTORIAN_LOOPS) {
                const timeRemaining = getTimeRemaining();
                if (timeRemaining < 90 * 1000) { // 90s minimum
                    historianStopReason = `time_budget_low:${Math.round(timeRemaining / 1000)}s`;
                    break;
                }

                historianLoops++;

                const latestTimeline = await runWithRetries(
                    `[STEP 3] Timeline refresh iteration ${historianLoops}`,
                    () => ctx.runQuery(internal.api.getRecentTimelineContextForHistorian, { limit: 40 }),
                );

                const result = await runWithRetries(
                    `[STEP 3] Historian iteration ${historianLoops}`,
                    () => runHistorianCycleInternal(ctx, {
                        cachedTimeline: latestTimeline,
                        cachedNewsContext,
                    }),
                );

                if (!result || result.processed === 0) {
                    historianStopReason = "idle";
                    break;
                }

                historianProcessed += result.processed;
                historianEventsCreated += result.eventsCreated || 0;
                historianEventsUpdated += result.eventsUpdated || 0;
                historianEventsDeleted += result.eventsDeleted || 0;
                historianSourcesMerged += result.sourcesMerged || 0;
                historianArchived += result.archived || 0;
                historianDiscarded += result.discarded || 0;
                historianCredibilityUpdated += result.credibilityUpdated || 0;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            if (historianLoops >= MAX_HISTORIAN_LOOPS) {
                historianStopReason = "max_iterations";
                console.warn(`[STEP 3] historian_reached_max_iterations limit=${MAX_HISTORIAN_LOOPS}`);
            }
        } catch (e) {
            historianStopReason = "failed";
            console.error("[STEP 3] historian_failed", e);
            const scheduledRetry = await scheduleStepRetry(ctx, {
                stepName: "STEP 3",
                actionReference: internal.research.step3_historian,
                args: { errors: stepErrors, runId },
                attempt,
            });
            if (scheduledRetry) return;
            stepErrors.push(`Historian: ${summarizeError(e)}`);
            console.warn("[STEP 3] Retry budget exhausted - moving to synthesis");
        }

        console.log(`[STEP 3] complete loops=${historianLoops} processed=${historianProcessed} created=${historianEventsCreated} updated=${historianEventsUpdated} deleted=${historianEventsDeleted} merged=${historianSourcesMerged} archived=${historianArchived} discarded=${historianDiscarded} credibilityUpdated=${historianCredibilityUpdated} stop=${historianStopReason} news=th:${cachedNewsContext?.TH?.length ?? 0},kh:${cachedNewsContext?.KH?.length ?? 0},int:${cachedNewsContext?.INT?.length ?? 0} accumulatedErrors=${stepErrors.length}`);

        // Chain to Step 4 (fresh 10-min timer for synthesis)
        try {
            await scheduleRunAfterWithRetries(ctx, "Step 4", 0, internal.research.step4_synthesis, {
                errors: stepErrors,
                runId,
                attempt: 0,
            });
        } catch (e) {
            console.error("[STEP 3] Failed to schedule Step 4:", e);
            const scheduledRetry = await scheduleStepRetry(ctx, {
                stepName: "STEP 3",
                actionReference: internal.research.step3_historian,
                args: { errors: stepErrors, runId },
                attempt,
            });
            if (scheduledRetry) return;

            await ctx.runMutation(internal.api.setStatus, {
                status: "online",
                errorLog: `Step 3 handoff failed after retries: ${summarizeError(e)}`.substring(0, 1900),
            });
            await ctx.runMutation(internal.api.releaseCycleLock, { runId });
        }
    },
});

// Step 4: Synthesis - Final analysis (gets full 10 mins)
export const step4_synthesis = internalAction({
    args: { errors: v.array(v.string()), runId: v.string(), attempt: v.optional(v.number()) },
    handler: async (ctx, { errors, runId, attempt = 0 }) => {
        const stats = await ctx.runQuery(internal.api.getSystemStatsInternal, {});
        if (stats?.isPaused || stats?.systemStatus === "stopped") {
            console.log("[STEP 4] Aborting step4_synthesis because system is paused/stopped.");
            await ctx.runMutation(internal.api.releaseCycleLock, { runId });
            return;
        }
        const stepErrors = [...errors];
        let schedulingResult: { nextCycleHours: number; reason: string } | null = null;
        let synthesisSucceeded = false;
        let dashboardUpdated = false;
        let synthesisWriteErrors = 0;

        try {
            const result = await runWithRetries(
                "[STEP 4] Synthesis",
                () => ctx.runAction(internal.research.synthesizeAll, {}),
            );
            if (!result) {
                console.warn("[STEP 4] synthesis_returned_no_result dashboardMayBeUnchanged=true");
                stepErrors.push("Synthesis: returned null result");
            } else {
                synthesisSucceeded = true;
                dashboardUpdated = result.dashboardUpdated === true;

                if (Array.isArray(result.writeErrors) && result.writeErrors.length > 0) {
                    synthesisWriteErrors = result.writeErrors.length;
                    for (const writeError of result.writeErrors) {
                        stepErrors.push(`SynthesisWrite: ${String(writeError)}`);
                    }
                }
            }

            // Extract scheduling decision from AI result
            if (result?.scheduling) {
                const sched = result.scheduling;
                schedulingResult = sched;
            }
        } catch (e) {
            console.error("[STEP 4] synthesis_failed", e);
            const scheduledRetry = await scheduleStepRetry(ctx, {
                stepName: "STEP 4",
                actionReference: internal.research.step4_synthesis,
                args: { errors: stepErrors, runId },
                attempt,
            });
            if (scheduledRetry) return;
            stepErrors.push(`Synthesis: ${summarizeError(e)}`);
            console.warn("[STEP 4] Retry budget exhausted - falling back to conservative scheduling");
        }

        // ═══ ADAPTIVE SCHEDULING with scheduler.runAt ═══
        // Schedule exact next run time (no more heartbeat polling!)
        const DEFAULT_INTERVAL_HOURS = 12;
        const SYNTHESIS_FALLBACK_INTERVAL_HOURS = 24;
        const aiSuggestedHours = schedulingResult?.nextCycleHours;
        const hasValidAiInterval = typeof aiSuggestedHours === "number" && Number.isFinite(aiSuggestedHours);
        const isSynthesisFallback = !hasValidAiInterval && !synthesisSucceeded;
        const nextHours = hasValidAiInterval
            ? aiSuggestedHours
            : isSynthesisFallback
                ? SYNTHESIS_FALLBACK_INTERVAL_HOURS
                : DEFAULT_INTERVAL_HOURS;
        const clampedHours = Math.max(4, Math.min(48, nextHours)); // Clamp to 4-48 range
        const nextRunAt = Date.now() + (clampedHours * 60 * 60 * 1000);
        const reason = schedulingResult?.reason
            || (isSynthesisFallback
                ? "Fallback scheduling (synthesis failed or returned no result); retrying in 24h"
                : "Default scheduling (synthesis did not return decision)");

        // ═══ CANCEL ALL PENDING runResearchCycle JOBS ═══
        // This prevents duplicate stacking from manual runs + scheduled runs
        let cancelledPendingJobs = 0;
        let pendingCancelFailures = 0;
        try {
            const pendingJobIds = await ctx.runQuery(internal.api.getPendingCycleJobs, {});
            if (pendingJobIds.length > 0) {
                for (const jobId of pendingJobIds) {
                    try {
                        await ctx.scheduler.cancel(jobId as any);
                        cancelledPendingJobs++;
                    } catch (e) {
                        // Job might have already run or been cancelled
                        pendingCancelFailures++;
                        console.warn(`[SCHEDULER] cancel_pending_failed jobId=${jobId} error=${summarizeError(e)}`);
                    }
                }
            }
        } catch (e) {
            // Non-fatal - continue with scheduling
            console.warn(`[SCHEDULER] pending_jobs_query_failed error=${summarizeError(e)}`);
        }

        // Schedule the exact next run time
        const scheduledRunId = await (async () => {
            try {
                const jobId = await scheduleRunAtWithRetries(
                    ctx,
                    "Next runResearchCycle",
                    nextRunAt,
                    internal.research.runResearchCycle,
                    {},
                );
                return jobId;
            } catch (e) {
                const scheduleError = `Scheduler runAt failed: ${String(e)}`;
                stepErrors.push(scheduleError);
                console.error(`[SCHEDULER] runAt_failed error=${summarizeError(e)}`);
                console.warn("[SCHEDULER] fallback=cron_safety_net");
                return undefined;
            }
        })();

        // Store scheduling info for frontend display and tracking
        await ctx.runMutation(internal.api.setNextRunAt, {
            nextRunAt,
            lastCycleInterval: clampedHours,
            schedulingReason: reason,
            scheduledRunId,
        });
        const shortReason = reason.substring(0, 160).replace(/"/g, "'");
        console.log(`[STEP 4] complete synthesisOk=${synthesisSucceeded} dashboardUpdated=${dashboardUpdated} writeErrors=${synthesisWriteErrors} nextRunHours=${clampedHours} nextRunAt=${new Date(nextRunAt).toISOString()} scheduledRunId=${scheduledRunId ?? "none"} cancelledPendingJobs=${cancelledPendingJobs} cancelFailures=${pendingCancelFailures} reason="${shortReason}" accumulatedErrors=${stepErrors.length}`);

        // ═══ CYCLE COMPLETE ═══
        // Increment cycle counter and trigger dashboard (every cycle now, since cycles are 16h+)
        const cycleCount = await ctx.runMutation(internal.api.incrementResearchCycleCount, {});
        const compactErrors = stepErrors.slice(0, 8).map((error) =>
            error.length > 240 ? `${error.substring(0, 240)}...` : error
        );
        const hiddenErrorCount = stepErrors.length - compactErrors.length;
        const errorLog = `${compactErrors.join(" | ")}${hiddenErrorCount > 0 ? ` | ...and ${hiddenErrorCount} more` : ""}`.substring(0, 1900);

        if (stepErrors.length === 0) {
            await ctx.runMutation(internal.api.setStatus, { status: "online" });
        } else {
            await ctx.runMutation(internal.api.setStatus, { status: "online", errorLog });
            console.warn(`[CYCLE] errors ${errorLog}`);
        }

        const verificationOk = !stepErrors.some((error) => error.startsWith("Verification:"));
        const historianOk = !stepErrors.some((error) => error.startsWith("Historian:"));
        let isrStatus = "skipped:no_site_url";

        // ═══ TRIGGER ISR REVALIDATION ═══
        // Purge Vercel's cache so the next user gets fresh data
        try {
            const VERCEL_URL = process.env.VERCEL_URL || process.env.SITE_URL;
            const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET;

            if (VERCEL_URL) {
                const revalidateUrl = VERCEL_URL.startsWith('http')
                    ? `${VERCEL_URL}/api/revalidate`
                    : `https://${VERCEL_URL}/api/revalidate`;

                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                };
                if (REVALIDATE_SECRET) {
                    headers['x-revalidate-secret'] = REVALIDATE_SECRET;
                }

                const maxRevalidateAttempts = 3;
                let revalidated = false;

                for (let attempt = 1; attempt <= maxRevalidateAttempts; attempt++) {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 15000);

                    try {
                        const response = await fetch(revalidateUrl, {
                            method: 'POST',
                            headers,
                            signal: controller.signal,
                        });

                        if (response.ok) {
                            const result = await response.json();
                            isrStatus = `ok:attempt_${attempt}`;
                            if (result?.revalidated === false) {
                                isrStatus = `ok:attempt_${attempt}:not_revalidated`;
                            }
                            revalidated = true;
                            clearTimeout(timeoutId);
                            break;
                        }

                        const responseText = (await response.text()).substring(0, 300);
                        console.warn(`[ISR] attempt_failed attempt=${attempt}/${maxRevalidateAttempts} status=${response.status} message=${responseText}`);
                    } catch (revalidateAttemptError) {
                        console.warn(`[ISR] attempt_failed attempt=${attempt}/${maxRevalidateAttempts} error=${summarizeError(revalidateAttemptError)}`);
                    } finally {
                        clearTimeout(timeoutId);
                    }

                    if (attempt < maxRevalidateAttempts) {
                        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
                    }
                }

                if (!revalidated) {
                    isrStatus = `failed:attempts_${maxRevalidateAttempts}`;
                    console.warn(`[ISR] failed attempts=${maxRevalidateAttempts}`);
                }
            }
        } catch (revalidateError) {
            // Non-fatal - don't fail the cycle just because revalidation failed
            isrStatus = `failed:${summarizeError(revalidateError)}`;
            console.warn(`[ISR] failed nonFatal=true error=${summarizeError(revalidateError)}`);
        }

        const cycleStatus = stepErrors.length === 0 ? "success" : "with_errors";
        console.log(`[CYCLE] complete cycle=${cycleCount} status=${cycleStatus} verificationOk=${verificationOk} historianOk=${historianOk} synthesisOk=${synthesisSucceeded} dashboardUpdated=${dashboardUpdated} errorCount=${stepErrors.length} nextRunAt=${new Date(nextRunAt).toISOString()} intervalHours=${clampedHours} scheduledRunId=${scheduledRunId ?? "none"} isr=${isrStatus}`);

        // ═══ RELEASE CYCLE LOCK ═══
        // Always release at the very end of the cycle
        await ctx.runMutation(internal.api.releaseCycleLock, { runId });
    },
});

// =============================================================================
// SOURCE VERIFICATION / ARTICLE CREDIBILITY ("articlecred" step)
// Pipeline: curator > articlecred > historian > synth
// Note: The old validation.ts loop is deprecated. This is the new approach.
// =============================================================================

/**
 * Verify all sources in the database
 * Goes through each queued article and verifies the supplied source with Gemini web search:
 * 1. URL is accessible (not 404)
 * 2. Summary matches actual content
 * 3. Title is accurate
 * 4. Article is about Thailand-Cambodia relations
 * 
 * Articles that fail verification get marked for deletion or credibility reduced
 */
export const verifyAllSources = internalAction({
    args: {},
    handler: async (ctx): Promise<{ verified: number; updated: number; deleted: number; errors: number }> => {
        console.log("🔍 [SOURCE VERIFY] Starting comprehensive source verification...");

        // Generate unique run ID
        const runId = `verify-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Try to acquire lock (prevents duplicate runs, cleans up zombies)
        const lockResult = await ctx.runMutation(internal.api.acquireSourceVerificationLock, { runId });

        if (!lockResult.acquired) {
            console.log(`❌ [SOURCE VERIFY] Could not acquire lock - another run is active`);
            return { verified: 0, updated: 0, deleted: 0, errors: 0 };
        }

        if (lockResult.tookOverZombie) {
            console.log(`🧟 [SOURCE VERIFY] Took over zombie session`);
        }

        console.log(`🔒 [SOURCE VERIFY] Lock acquired (runId: ${runId})`);

        // Wrap in try/finally to ensure lock is always released
        try {
            const [
                cambodiaArticles,
                thailandArticles,
                internationalArticles,
                cambodiaDuplicateCandidates,
                thailandDuplicateCandidates,
                internationalDuplicateCandidates,
            ]: [
                any[],
                any[],
                any[],
                DuplicateCandidate[],
                DuplicateCandidate[],
                DuplicateCandidate[],
            ] = await Promise.all([
                ctx.runQuery(internal.api.getArticlesNeedingVerification, { country: "cambodia", limit: 220 }),
                ctx.runQuery(internal.api.getArticlesNeedingVerification, { country: "thailand", limit: 220 }),
                ctx.runQuery(internal.api.getArticlesNeedingVerification, { country: "international", limit: 220 }),
                ctx.runQuery(internal.api.getRecentDuplicateCandidates, { country: "cambodia", limit: 180 }),
                ctx.runQuery(internal.api.getRecentDuplicateCandidates, { country: "thailand", limit: 180 }),
                ctx.runQuery(internal.api.getRecentDuplicateCandidates, { country: "international", limit: 180 }),
            ]);

            const duplicateCandidatesByCountry = {
                cambodia: cambodiaDuplicateCandidates,
                thailand: thailandDuplicateCandidates,
                international: internationalDuplicateCandidates,
            } as const;

            const allArticles = [
                ...cambodiaArticles.map(a => ({ ...a, country: "cambodia" as const })),
                ...thailandArticles.map(a => ({ ...a, country: "thailand" as const })),
                ...internationalArticles.map(a => ({ ...a, country: "international" as const })),
            ];

            console.log(`📊 [SOURCE VERIFY] Verification queue loaded`);
            console.log(`   Cambodia: ${cambodiaArticles.length}, Thailand: ${thailandArticles.length}, International: ${internationalArticles.length}`);
            console.log(`   → Will verify: ${allArticles.length} queued articles`);

            let verified = 0;
            let flagged = 0;
            let deleted = 0;
            let errors = 0;

            const findDuplicateForArticle = (
                article: { country: "cambodia" | "thailand" | "international"; title: string },
                candidate: { title?: string; sourceUrl?: string; publishedAt?: number },
            ) => findVerifiedDuplicateCandidate({
                currentTitle: article.title,
                candidateTitle: candidate.title,
                candidateUrl: candidate.sourceUrl,
                candidatePublishedAt: candidate.publishedAt,
                candidates: duplicateCandidatesByCountry[article.country],
            });

            // Early return if no articles to verify
            if (allArticles.length === 0) {
                console.log(`✅ [SOURCE VERIFY] No articles to verify!`);
                return { verified: 0, updated: 0, deleted: 0, errors: 0 };
            }

            // Keep each Gemini browser task small. Asking one generation to visit ten
            // unrelated URLs repeatedly produced refusals/dead response shells.
            const BATCH_SIZE = 3;

            // Time budget - stop processing before Convex timeout
            const startTime = Date.now();
            const MAX_RUNTIME_MS = 8 * 60 * 1000; // 8 mins (2 min buffer before 10 min limit)
            const getTimeRemaining = () => MAX_RUNTIME_MS - (Date.now() - startTime);

            for (let i = 0; i < allArticles.length; i += BATCH_SIZE) {
                // TIME CHECK - Stop if running low on time
                const timeRemaining = getTimeRemaining();
                if (timeRemaining < 60 * 1000) { // Need at least 1 min for a batch
                    const remaining = allArticles.length - i;
                    console.log(`\n⏰ [SOURCE VERIFY] Time budget exhausted (${Math.round(timeRemaining / 1000)}s left)`);
                    console.log(`   📋 ${remaining} articles will be verified in the next cycle`);
                    break;
                }

                const batch = allArticles.slice(i, i + BATCH_SIZE);
                const batchNum = Math.floor(i / BATCH_SIZE) + 1;
                const totalBatches = Math.ceil(allArticles.length / BATCH_SIZE);
                console.log(`\n📦 [SOURCE VERIFY] Processing batch ${batchNum}/${totalBatches}...`);

                // Update heartbeat so we don't get marked as zombie
                await ctx.runMutation(internal.api.updateSourceVerificationProgress, {
                    runId,
                    progress: `batch ${batchNum}/${totalBatches}`,
                });

                // Build verification prompt for the batch
                const articlesToVerify = batch.map((a, idx) => {
                    const storedDate = a.publishedAt ? new Date(a.publishedAt).toISOString() : "(unknown)";
                    return `ARTICLE ${idx + 1}:
URL: ${a.sourceUrl || "(missing)"}
Stored Title: "${a.title}"
Stored Summary: "${a.summary || a.summaryEn || "(none)"}"
Stored Date: ${storedDate}
Country: ${a.country}
Credibility: ${a.credibility}`;
                }).join("\n\n");

                const verificationPrompt = `You are a SOURCE VERIFICATION AGENT. Verify whether each stored news record refers to a real Thailand-Cambodia article from the stated publisher.

VERIFICATION METHOD:
1. First try the exact URL.
2. If the exact page is blocked or unavailable to your browser, use Google Search with the exact headline plus publisher/domain to corroborate the SAME article. Search evidence may confirm the record, but do not replace it with a different article.
3. Compare publisher, headline, topic, summary, and publication date using the strongest evidence you can actually observe.
4. Preserve articles when evidence is incomplete.

STATUSES:
- VERIFIED: strong evidence from the exact page OR same-publisher/domain search evidence confirms this exact article and the stored record is materially correct.
- NEEDS_UPDATE: strong evidence confirms the exact article but proves stored title, summary, date, or URL metadata is materially wrong.
- URL_DEAD: the exact URL explicitly returns 404, 410, page-not-found, or the publisher clearly says it was removed. A 403, login wall, bot block, timeout, or browser limitation is NOT URL_DEAD.
- OFF_TOPIC: strong evidence proves the exact article is real but not about Thailand-Cambodia border/relations.
- HALLUCINATED: strong evidence proves the exact URL/title refers to unrelated content.
- SKIP: evidence is insufficient, blocked, ambiguous, or cannot be corroborated. Prefer SKIP over guessing.

IMPORTANT:
- Never mark URL_DEAD just because you cannot access a page.
- Never substitute a similar article from another URL.
- Search by exact title + publisher/domain is allowed only to corroborate the supplied record.
- Keep articleIndex matched to the supplied article.

ARTICLES TO VERIFY:
${articlesToVerify}

Return EXACTLY one fenced \`\`\`json code block and nothing else:
\`\`\`json
{
  "results": [
    {
      "articleIndex": 1,
      "status": "VERIFIED|NEEDS_UPDATE|URL_DEAD|OFF_TOPIC|HALLUCINATED|SKIP",
      "actualTitle": "observed headline or null",
      "actualSummary": "brief evidence-based summary or null",
      "actualPublishedAt": "ISO timestamp with +07:00 when known, otherwise null",
      "isAboutBorder": true,
      "matchScore": 85,
      "reason": "brief evidence for the decision",
      "correctData": {}
    }
  ]
}
\`\`\`

For NEEDS_UPDATE, put only fields that are proven wrong in correctData. For every other status use an empty correctData object.`;

                try {
                    const response = await callGeminiStudioWithFallback(verificationPrompt, FALLBACK_CHAINS.critical, 1, "SOURCE-VERIFY");

                    // Extract JSON
                    const extractJsonPayload = (input: string): string | null => {
                        const fencedMatch = input.match(/```json\s*([\s\S]*?)```/i);
                        if (fencedMatch) return fencedMatch[1].trim();

                        const tagMatch = input.match(/<json>([\s\S]*?)<\/json>/i);
                        if (tagMatch) return tagMatch[1].trim();

                        const cleanedResponse = input
                            .replace(/```json\s*/gi, "")
                            .replace(/```\s*/g, "")
                            .trim();
                        const firstOpen = cleanedResponse.indexOf("{");
                        const lastClose = cleanedResponse.lastIndexOf("}");
                        if (firstOpen !== -1 && lastClose !== -1) {
                            return cleanedResponse.substring(firstOpen, lastClose + 1);
                        }

                        return null;
                    };
                    const unwrapJsonStringEnvelope = (input: string): string => {
                        const trimmed = input.trim();
                        if (!trimmed.startsWith("\"")) return input;

                        try {
                            const parsed = JSON.parse(trimmed);
                            return typeof parsed === "string" ? parsed : input;
                        } catch {
                            return input;
                        }
                    };
                    const normalizeJsonCandidate = (input: string): string => {
                        let normalized = unwrapJsonStringEnvelope(input).trim();
                        for (let j = 0; j < 2; j++) {
                            normalized = normalized
                                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
                                .replace(/\\<json>/gi, "<json>")
                                .replace(/\\<\/json>/gi, "</json>")
                                .replace(/"\[([^\]]*)\]\(([^)]+)\)"/g, "\"$2\"")
                                .replace(/,\s*([\]\}])/g, "$1")
                                .replace(/[\uFEFF\u200B\u200C\u200D]/g, "")
                                .replace(/\\(?=[!<>&`])/g, "")
                                .replace(/\\(?![\"\\/bfnrtu])/g, "\\\\");
                        }
                        return normalized;
                    };
                    const jsonStr = extractJsonPayload(response);

                    if (!jsonStr) {
                        console.log(`   ⚠️ No JSON in response, skipping batch`);
                        errors += batch.length;
                        continue;
                    }

                    // Parse JSON with error handling
                    let result;
                    try {
                        result = JSON.parse(normalizeJsonCandidate(jsonStr));
                    } catch (parseError: any) {
                        console.log(`   ⚠️ Failed to parse JSON: ${parseError.message}`);
                        console.log(`   Raw JSON (first 200 chars): ${jsonStr.substring(0, 200)}`);
                        errors += batch.length;
                        continue;
                    }

                    // Track which articles in batch were processed
                    const processedIndices = new Set<number>();

                    // Process results
                    for (const r of result.results || []) {
                        // Convert from 1-indexed (prompt) to 0-indexed (array)
                        const rawIndex = r.articleIndex || 1;
                        const articleIndex = rawIndex - 1;

                        // Validate index - if out of range, try to find by URL matching
                        let article = null;
                        if (articleIndex >= 0 && articleIndex < batch.length) {
                            article = batch[articleIndex];
                        } else {
                            // Fallback: try to find article by URL if AI returned wrong index
                            const matchedByUrl = batch.find(a => r.url && a.sourceUrl === r.url);
                            if (matchedByUrl) {
                                article = matchedByUrl;
                                console.log(`   ⚠️ Index ${rawIndex} out of range, but found by URL match`);
                            } else {
                                console.log(`   ⚠️ Invalid articleIndex ${rawIndex} (batch has ${batch.length}), skipping`);
                                continue;
                            }
                        }

                        processedIndices.add(batch.indexOf(article));
                        const status = r.status?.toUpperCase() || "UNKNOWN";

                        try {
                            switch (status) {
                            case "VERIFIED":
                                {
                                    const duplicate = findDuplicateForArticle(article, {
                                        title: r.actualTitle || article.title,
                                        sourceUrl: article.sourceUrl,
                                        publishedAt: article.publishedAt,
                                    });

                                    if (duplicate) {
                                        await ctx.runMutation(internal.api.flagArticle, {
                                            title: article.title,
                                            country: article.country,
                                            status: "archived",
                                        });
                                        article.status = "archived";
                                        flagged++;
                                        console.log(`   🔄 DUPLICATE (verified match)`);
                                        console.log(`      Current: "${article.title}"`);
                                        console.log(`      Existing: "${duplicate.duplicateTitle}"`);
                                        console.log(`      Reason: ${duplicate.reason}`);
                                        break;
                                    }
                                }

                                // Mark as source-verified so it won't be re-checked
                                await ctx.runMutation(internal.api.markSourceVerified, {
                                    title: article.title,
                                    country: article.country,
                                });
                                article.sourceVerifiedAt = Date.now();
                                article.status = "active";
                                verified++;
                                console.log(`   ✅ VERIFIED: "${article.title?.substring(0, 50)}..."`);
                                console.log(`      URL: ${article.sourceUrl}`);
                                console.log(`      Match: ${r.matchScore || 100}%`);
                                break;

                            case "URL_DEAD":
                                // Delete articles with dead URLs
                                try {
                                    await ctx.runMutation(internal.api.deleteArticle, {
                                        title: article.title,
                                        country: article.country,
                                    });
                                    deleted++;
                                    console.log(`   🗑️ DELETED (404 - URL Dead)`);
                                    console.log(`      URL: ${article.sourceUrl}`);
                                    console.log(`      Old Title: "${article.title}"`);
                                    console.log(`      Reason: ${r.reason || "URL not accessible"}`);
                                } catch (e) {
                                    console.log(`   ⚠️ Failed to delete: "${article.title?.substring(0, 40)}..."`);
                                    flagged++;
                                }
                                break;

                            case "URL_WRONG":
                                // DEPRECATED: URL_WRONG is no longer a valid status
                                // If AI still returns it, treat as SKIP (we don't want URL replacements)
                                console.log(`   ⏭️ SKIPPED (URL_WRONG is deprecated - treating as SKIP)`);
                                console.log(`      URL: ${article.sourceUrl}`);
                                console.log(`      Reason: ${r.reason || "Will retry next cycle"}`);
                                // Don't mark as verified - will retry later
                                break;

                            case "HALLUCINATED":
                                // Hallucinated = definitely delete
                                try {
                                    await ctx.runMutation(internal.api.deleteArticle, {
                                        title: article.title,
                                        country: article.country,
                                    });
                                    deleted++;
                                    console.log(`   🗑️ DELETED (HALLUCINATED - Curator made this up!)`);
                                    console.log(`      URL: ${article.sourceUrl}`);
                                    console.log(`      Curator said: "${article.title}"`);
                                    console.log(`      Curator summary: "${(article.summary || article.summaryEn || "").substring(0, 100)}..."`);
                                    console.log(`      Page actually says: "${r.actualTitle || "(couldn't read)"}"`);
                                    console.log(`      Page is about: ${r.actualSummary || r.actualTopic || "(unknown)"}`);
                                    console.log(`      Reason: ${r.reason || "Content completely different"}`);
                                } catch (e) {
                                    console.log(`   ⚠️ Failed to delete hallucinated article`);
                                    flagged++;
                                }
                                break;

                            case "NEEDS_UPDATE":
                                // URL is valid, article IS about Thailand-Cambodia, but data is wrong
                                // Only update fields that AI says need fixing (sparse update)
                                const cd = r.correctData || {}; // correctData object - only contains fields that need fixing

                                // Only use corrected values if AI provided them, otherwise keep existing
                                const hasTitle = cd.title !== undefined;
                                const hasSummary = cd.summary !== undefined || cd.summaryEn !== undefined;
                                const hasDate = cd.publishedAt !== undefined || r.actualPublishedAt !== undefined;
                                const hasUrl = cd.sourceUrl !== undefined;

                                // Build update object with only changed fields
                                const updateData: any = {
                                    country: article.country,
                                    oldTitle: article.title,
                                    credibility: Math.min(100, (article.credibility || 50) + 10), // Boost cred - now verified!
                                    status: "active",
                                };

                                // Add URL if it needs fixing
                                if (hasUrl) {
                                    updateData.newUrl = cd.sourceUrl;
                                }
                                if (hasTitle) {
                                    updateData.newTitle = cd.title || r.actualTitle;
                                    // Use undefined checks to allow empty strings (clearing values)
                                    if (cd.titleEn !== undefined) updateData.newTitleEn = cd.titleEn;
                                    if (cd.titleTh !== undefined) updateData.newTitleTh = cd.titleTh;
                                    if (cd.titleKh !== undefined) updateData.newTitleKh = cd.titleKh;
                                }

                                // Only add summary fields if summary needs fixing
                                if (hasSummary) {
                                    updateData.newSummary = cd.summary || cd.summaryEn || r.actualSummary || "";
                                    if (cd.summaryEn !== undefined) updateData.newSummaryEn = cd.summaryEn;
                                    if (cd.summaryTh !== undefined) updateData.newSummaryTh = cd.summaryTh;
                                    if (cd.summaryKh !== undefined) updateData.newSummaryKh = cd.summaryKh;
                                }

                                // Only add date if date needs fixing
                                if (hasDate) {
                                    const dateStr = cd.publishedAt || r.actualPublishedAt;
                                    if (dateStr && dateStr !== "null") {
                                        const parsed = new Date(dateStr).getTime();
                                        if (!isNaN(parsed)) {
                                            updateData.publishedAt = parsed;
                                        }
                                    }
                                }

                                try {
                                    const duplicate = findDuplicateForArticle(article, {
                                        title: updateData.newTitle || r.actualTitle || article.title,
                                        sourceUrl: updateData.newUrl || article.sourceUrl,
                                        publishedAt: updateData.publishedAt || article.publishedAt,
                                    });

                                    if (duplicate) {
                                        await ctx.runMutation(internal.api.flagArticle, {
                                            title: article.title,
                                            country: article.country,
                                            status: "archived",
                                        });
                                        article.status = "archived";
                                        flagged++;
                                        console.log(`   🔄 DUPLICATE (verified update match)`);
                                        console.log(`      Current: "${article.title}"`);
                                        console.log(`      Existing: "${duplicate.duplicateTitle}"`);
                                        console.log(`      Reason: ${duplicate.reason}`);
                                        break;
                                    }

                                    await ctx.runMutation(internal.api.updateArticleContent, updateData);
                                    if (updateData.newTitle) article.title = updateData.newTitle;
                                    if (updateData.newUrl) article.sourceUrl = updateData.newUrl;
                                    if (updateData.publishedAt) article.publishedAt = updateData.publishedAt;
                                    article.sourceVerifiedAt = Date.now();
                                    article.status = "active";
                                    flagged++; // Count as "fixed"

                                    // Smart logging - only show what actually changed
                                    console.log(`   📝 UPDATED`);
                                    console.log(`      URL: ${article.sourceUrl}`);

                                    if (hasTitle) {
                                        console.log(`      Title: "${article.title?.substring(0, 50)}..." → "${(cd.title || r.actualTitle)?.substring(0, 50)}..."`);
                                    }
                                    if (hasSummary) {
                                        console.log(`      Summary: Updated`);
                                    }
                                    if (hasDate && updateData.publishedAt) {
                                        const oldDate = article.publishedAt ? new Date(article.publishedAt).toISOString() : "(unknown)";
                                        const newDate = new Date(updateData.publishedAt).toISOString();
                                        console.log(`      Date: ${oldDate} → ${newDate}`);
                                    }
                                    if (hasUrl) {
                                        console.log(`      URL Fixed: ${article.sourceUrl} → ${cd.sourceUrl}`);
                                    }
                                    console.log(`      Reason: ${r.reason || "Data didn't match actual content"}`);
                                } catch (e) {
                                    console.log(`   ⚠️ Failed to update article content`);
                                    errors++;
                                }
                                break;

                            case "OFF_TOPIC":
                                // Delete off-topic articles
                                try {
                                    await ctx.runMutation(internal.api.deleteArticle, {
                                        title: article.title,
                                        country: article.country,
                                    });
                                    deleted++;
                                    console.log(`   🗑️ DELETED (OFF-TOPIC - Not about Thailand-Cambodia)`);
                                    console.log(`      URL: ${article.sourceUrl}`);
                                    console.log(`      Curator said: "${article.title}"`);
                                    console.log(`      Page is actually about: ${r.actualSummary || r.actualTopic || "(unknown)"}`);
                                    console.log(`      Reason: ${r.reason || "Not related to Thailand-Cambodia border"}`);
                                } catch (e) {
                                    console.log(`   ⚠️ Failed to delete off-topic article`);
                                    flagged++;
                                }
                                break;

                            case "SKIP":
                                // AI couldn't access URL - DON'T mark as verified so we can retry later
                                console.log(`   ⏭️ SKIPPED (AI couldn't access URL - will retry next cycle)`);
                                console.log(`      URL: ${article.sourceUrl}`);
                                console.log(`      Reason: ${r.reason || "Could not access URL"}`);
                                // Don't increment any counter - article stays unverified for next attempt
                                break;

                            default:
                                console.log(`   ❓ Unknown status "${status}" for: "${article.title?.substring(0, 40)}..."`);
                                errors++;
                        }
                        } catch (resultError) {
                            console.log(`   Error processing verification result for "${article.title?.substring(0, 40)}...": ${resultError}`);
                            errors++;
                        }
                    }

                    // Check for articles not returned by AI (missing from results)
                    const unprocessedCount = batch.length - processedIndices.size;
                    if (unprocessedCount > 0) {
                        console.log(`   ⚠️ ${unprocessedCount} article(s) not returned by AI - counting as errors`);
                        for (let idx = 0; idx < batch.length; idx++) {
                            if (!processedIndices.has(idx)) {
                                console.log(`      Missing: "${batch[idx].title?.substring(0, 40)}..."`);
                            }
                        }
                        errors += unprocessedCount;
                    }

                } catch (error: any) {
                    console.log(`   ❌ Batch error: ${error.message}`);
                    errors += batch.length;
                }

                // Add delay between batches to avoid rate limiting
                if (i + BATCH_SIZE < allArticles.length) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            console.log(`\n═══════════════════════════════════════════════════════════════`);
            console.log(`🔍 [SOURCE VERIFY] COMPLETE`);
            console.log(`   ✅ Verified: ${verified}`);
            console.log(`   📝 Updated (fixed content): ${flagged}`);
            console.log(`   🗑️ Deleted: ${deleted}`);
            console.log(`   ❌ Errors: ${errors}`);
            console.log(`═══════════════════════════════════════════════════════════════`);

            return { verified, updated: flagged, deleted, errors };
        } finally {
            // Always release the lock, even if there's an error
            await ctx.runMutation(internal.api.releaseSourceVerificationLock, { runId });
        }
    },
});

/**
 * Verify a single article - useful for testing
 */
export const verifySingleSource = internalAction({
    args: {
        url: v.string(),
        storedTitle: v.string(),
        storedSummary: v.string(),
    },
    handler: async (ctx, args): Promise<{ status: string; actualTitle?: string; actualTopic?: string; matchScore?: number; reason: string }> => {
        console.log(`🔍 [SINGLE VERIFY] Checking: ${args.url}`);

        const verificationPrompt = `You are a SOURCE VERIFICATION AGENT. Verify this stored record:
URL: ${args.url}
Stored Title: "${args.storedTitle}"
Stored Summary: "${args.storedSummary}"

First try the exact URL. If the page is blocked or unavailable to your browser, use Google Search with the exact headline and publisher/domain to corroborate the SAME article. Do not substitute a different article.

URL_DEAD requires explicit 404, 410, page-not-found, or clear publisher removal. A 403, login wall, bot block, timeout, or browser limitation is NOT URL_DEAD. If evidence is insufficient, return SKIP.

Return EXACTLY one fenced \`\`\`json code block and nothing else:
\`\`\`json
{
  "status": "VERIFIED|URL_DEAD|CONTENT_MISMATCH|OFF_TOPIC|HALLUCINATED|SKIP",
  "actualTitle": "observed headline or null",
  "actualTopic": "brief observed topic or null",
  "matchScore": 85,
  "reason": "brief evidence for the decision"
}
\`\`\``;

        try {
            const response = await callGeminiStudioWithFallback(verificationPrompt, FALLBACK_CHAINS.critical, 1, "VERIFY-SINGLE");

            // Extract JSON
            const fencedMatch = response.match(/```json\s*([\s\S]*?)```/i);
            const tagMatch = response.match(/<json>([\s\S]*?)<\/json>/i);
            const jsonStr = fencedMatch
                ? fencedMatch[1].trim()
                : tagMatch
                    ? tagMatch[1].trim()
                    : null;

            if (!jsonStr) {
                return { status: "ERROR", reason: "Failed to parse AI response" };
            }

            const normalizedJson = jsonStr
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
                .replace(/\\<json>/gi, "<json>")
                .replace(/\\<\/json>/gi, "</json>")
                .replace(/"\[([^\]]*)\]\(([^)]+)\)"/g, "\"$2\"")
                .replace(/,\s*([\]\}])/g, "$1")
                .replace(/[\uFEFF\u200B\u200C\u200D]/g, "")
                .replace(/\\(?=[!<>&`])/g, "")
                .replace(/\\(?![\"\\/bfnrtu])/g, "\\\\");

            return JSON.parse(normalizedJson);

        } catch (error: any) {
            console.log(`❌ Verification failed: ${error.message}`);
            return { status: "ERROR", reason: error.message };
        }
    },
});

// =============================================================================
// MANUAL BACKFILL TOOL
// =============================================================================

export const curateManualGap = internalAction({
    args: {
        date: v.string(), // e.g. "December 7, 2025" or "2025-12-07"
        perspective: v.optional(v.string()) // Optional: "cambodia", "thailand", "international"
    },
    handler: async (ctx, args) => {
        const targetDate = args.date;
        console.log(`🕵️ [MANUAL BACKFILL] Starting curation for date: ${targetDate}`);

        const perspectives = args.perspective
            ? [args.perspective]
            : ["cambodia", "thailand", "international"];

        const results_summary: string[] = [];

        for (const p of perspectives) {
            const country = p as "cambodia" | "thailand" | "international";
            console.log(`\n👉 Backfilling ${country.toUpperCase()} for ${targetDate}...`);

            // Get existing URLs to avoid duplicates
            try {
                // We use try-catch because getExistingTitlesInternal might be internal.api or api.api depending on structure
                // In this file, internal.api is used.
                const existing = await ctx.runQuery(internal.api.getExistingTitlesInternal, { country });
                // We map to verify we have array
                const existingUrls = Array.isArray(existing) ? existing.map((a: any) => a.sourceUrl).join("\n") : "";

                let specificInstructions = "";
                let sourceList = "";

                // 1. CAMBODIA CONFIG
                if (country === "cambodia") {
                    specificInstructions = `
🇰🇭 YOUR PERSPECTIVE: You are searching for news as if you were a CAMBODIAN CITIZEN.
Find news articles that Cambodians would see on their local TV, newspapers, and news websites.

🌐 SEARCH IN MULTIPLE LANGUAGES:
- Search in KHMER: ព្រំដែនថៃ-កម្ពុជា, ជម្លោះព្រំដែន, កងទ័ពថៃ, ទំនាក់ទំនងថៃកម្ពុជា date:${targetDate}
- Search in ENGLISH: Thailand Cambodia border, Cambodia news date:${targetDate}
- PRIORITIZE Khmer-language sources!`;

                    sourceList = `
📺 CAMBODIAN NEWS SOURCES (these are what Cambodians read):
KHMER LANGUAGE (prioritize these!):
• Fresh News ហ្វ្រេសញូស (freshnewsasia.com)
• DAP News ដាប់ញូស (dap-news.com)
• VOD វីអូឌី (vodkhmer.news)
• RFA Khmer វិទ្យុអាស៊ីសេរី (rfa.org/khmer)
• Sabay News សប្បាយញូស (sabay.com.kh)
• Thmey Thmey ថ្មីថ្មី (thmey-thmey.com)
• CNC ស៊ីអិនស៊ី (cnc.com.kh)
• TVK ទូរទស្សន៍កម្ពុជា - National TV
• BTV ប៊ីធីវី (btv.com.kh) - Bayon TV

ENGLISH LANGUAGE:
• Phnom Penh Post (phnompenhpost.com)
• Khmer Times (khmertimeskh.com)
• Cambodia Daily (cambodiadaily.com)
• AKP - Agence Kampuchea Presse (akp.gov.kh)`;
                }

                // 2. THAILAND CONFIG
                else if (country === "thailand") {
                    specificInstructions = `
🇹🇭 YOUR PERSPECTIVE: You are searching for news as if you were a THAI CITIZEN.
Find news articles that Thais would see on their local TV, newspapers, and news websites.

🌐 SEARCH IN MULTIPLE LANGUAGES:
- Search in THAI: ชายแดนไทย-กัมพูชา, ข่าวชายแดน, ทหารไทย, ความสัมพันธ์ไทยกัมพูชา, ปราสาทพระวิหาร date:${targetDate}
- Search in ENGLISH: Thailand Cambodia border, Thai news, Bangkok Post date:${targetDate}
- PRIORITIZE Thai-language sources!`;

                    sourceList = `
📺 THAI NEWS SOURCES (these are what Thais read):
THAI LANGUAGE (prioritize these!):
• ไทยรัฐ Thai Rath (thairath.co.th)
• เดลินิวส์ Daily News (dailynews.co.th)
• มติชน Matichon (matichon.co.th)
• ข่าวสด Khaosod (khaosod.co.th)
• คมชัดลึก Kom Chad Luek (komchadluek.net)
• PPTV HD 36 (pptvhd36.com)
• ช่อง 3 Channel 3 (ch3thailand.com)
• ช่อง 7 Channel 7 (ch7.com)
• Thai PBS ไทยพีบีเอส (thaipbs.or.th)
• กรุงเทพธุรกิจ (bangkokbiznews.com)
• ผู้จัดการ Manager (mgronline.com)

ENGLISH LANGUAGE:
• Bangkok Post (bangkokpost.com)
• The Nation Thailand (nationthailand.com)
• Thai PBS World (thaipbsworld.com)
• Khaosod English (khaosodenglish.com)`;
                }

                // 3. INTERNATIONAL CONFIG
                else if (country === "international") {
                    specificInstructions = `
🌍 YOUR PERSPECTIVE: You are an OUTSIDE OBSERVER - not Thai, not Cambodian.
Find news from international wire services and global news outlets.

🌐 SEARCH IN ENGLISH:
- Search: Thailand Cambodia border conflict, Thailand Cambodia tensions, Southeast Asia border dispute date:${targetDate}
- Focus on WIRE SERVICES and GLOBAL NEWS OUTLETS`;

                    sourceList = `
📺 INTERNATIONAL SOURCES (prioritize these):
WIRE SERVICES (highest credibility):
• Reuters (reuters.com)
• Associated Press / AP News (apnews.com)
• AFP / Agence France-Presse (france24.com)

GLOBAL NEWS OUTLETS:
• BBC (bbc.com)
• Al Jazeera (aljazeera.com)
• CNN International (cnn.com)
• The Guardian (theguardian.com)
• DW Deutsche Welle (dw.com)
• The Diplomat (thediplomat.com)
• Nikkei Asia (asia.nikkei.com)
• South China Morning Post (scmp.com)
• Channel News Asia (channelnewsasia.com)
• Voice of America (voanews.com)
• UN News (news.un.org)`;
                }

                // CONSTRUCT PROMPT with DATE OVERRIDE
                const prompt = `You are a HISTORICAL NEWS RESEARCHER finding articles for a SPECIFIC DATE.
                
Target Date: ${targetDate}

${specificInstructions}

⛔⛔⛔ CRITICAL ANTI-HALLUCINATION RULES ⛔⛔⛔
🚫 DO NOT FABRICATE URLS - Every URL must be real and lead to an article published on ${targetDate}
🚫 DO NOT GUESS URLS
🚫 DO NOT INVENT ARTICLES
🚫 ZERO ARTICLES IS ACCEPTABLE if nothing found for this specific date

🚨 DATE STRICTNESS IS CRITICAL:
- ONLY find news articles published on ${targetDate} or events occurring on ${targetDate}
- Verify the "Published: ..." date on the page matches ${targetDate}
- Do NOT return articles from "Today" (unless today is ${targetDate} in the prompt)
- Do NOT return old articles from years ago

⚠️ WE VERIFY EVERY URL - If your URL returns 404 or doesn't match the date, you have failed.

🔍 YOUR TASK: Search the web for verified news articles about Thailand-Cambodia relations published on ${targetDate} (${country.toUpperCase()} sources).

${sourceList}

⛔ DUPLICATE CHECK - SKIP THESE URLs (we already have them):
${existingUrls || "(database is empty - find new articles!)"}

☝️ DO NOT return any article with a URL from the list above.

FOCUS:
- What happened ON THIS SPECIFIC DAY (${targetDate})?
- Missed events that we need to backfill
- Official statements, clashes, or diplomatic moves on this day

CREDIBILITY SCORING & SUMMARY RULES:
(Same as standard curation - be critical, don't embellish)

${TRANSLATION_STYLE_GUIDE}

OUTPUT FORMAT - Return EXACTLY one fenced \`\`\`json code block:
\`\`\`json
{
  "newArticles": [
    {
      "title": "Headline",
      "titleEn": "English Headline",
      "titleTh": "Thai local headline, plain and concise",
      "titleKh": "Khmer local headline, plain and concise",
      "publishedAt": "${targetDate}THH:mm:ss+07:00 (Estimate time if unknown, but KEEP DATE CORRECT)",
      "sourceUrl": "https://...",
      "source": "Publication Name",
      "category": "military|political|humanitarian|diplomatic",
      "credibility": 80,
      "summary": "Summary of event on ${targetDate}...",
      "summaryEn": "Summary in English",
      "summaryTh": "Thai local summary, 1-2 short sentences",
      "summaryKh": "Khmer local summary, 1-2 short sentences"
    }
  ],
  "flaggedTitles": []
}
\`\`\`

RULES:
- Return EXACTLY one fenced \`\`\`json code block and NOTHING else
- Inside the fence, output valid JSON only
- DATE MUST BE ${targetDate}
- No prose before or after the JSON block`;

                // Call the shared processor
                const result = await processNewsResponse(ctx, prompt, country);
                results_summary.push(`${country}: +${result.newArticles}`);

            } catch (err: any) {
                console.error(`❌ [MANUAL BACKFILL] Error for ${country}: ${err.message}`);
                results_summary.push(`${country}: ERROR`);
            }
        }

        // Reset the auto-cycle timer since we just did a manual run
        await ctx.runMutation(internal.api.setSkipNextCycle, {});

        console.log(`✅ [MANUAL BACKFILL] Completed ${targetDate}: ${results_summary.join(", ")}`);
        return `Backfill Complete for ${targetDate}: ${results_summary.join(", ")}`;
    }
});
