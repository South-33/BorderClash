"use node";

import { internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { FunctionReference } from "convex/server";
import { v } from "convex/values";
import { runHistorianCycleInternal } from "./historian";
import { canonicalizeArticleUrl, findVerifiedDuplicateCandidate, type DuplicateCandidate } from "./dedupe";
import {
    assessSourceEvidence,
    collectCurationCandidates,
    collectSourceEvidence,
    type CurationCandidate,
    type CurationCountry,
} from "./source_evidence";
import { GEMINI_THINKING } from "./config";
import { LOCALIZED_WRITING_RULES, isValidLocalizedText, normalizeLocalizedDigits } from "./language_quality";

// Use gemini-studio-api helpers
import {
    callGeminiStudioWithSelfHealing,
    formatTimelineEvent,
    repairLocalizedItems,
    type LocalizedRepairItem,
} from "./ai_utils";


// =============================================================================
// SHARED UTILS (deprecated Ghost API endpoints removed)
// =============================================================================

const ACTION_RETRY_DELAYS_MS = [5000, 15000] as const;
const CHAIN_SCHEDULER_RETRY_DELAYS_MS = [2000, 5000, 10000] as const;
const STEP_RETRY_DELAYS_MS = [60_000, 5 * 60_000] as const;
const CURATION_OUTAGE_RETRY_DELAYS_MS = [5 * 60 * 60_000, 24 * 60 * 60_000] as const;

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

async function scheduleCurationOutageRetry(
    ctx: any,
    attempt: number,
): Promise<{ scheduled: boolean; nextRunAt?: number; delayHours?: number }> {
    const retryIndex = Math.min(attempt, CURATION_OUTAGE_RETRY_DELAYS_MS.length - 1);
    const delayMs = CURATION_OUTAGE_RETRY_DELAYS_MS[retryIndex];
    const delayHours = delayMs / (60 * 60_000);
    const nextRunAt = Date.now() + delayMs;

    // Replace older pending cycle work so an outage retry cannot stack beside
    // the previous adaptive schedule.
    try {
        const pendingJobIds = await ctx.runQuery(internal.api.getPendingCycleJobs, {});
        for (const jobId of pendingJobIds) {
            try {
                await ctx.scheduler.cancel(jobId as any);
            } catch (cancelError) {
                console.warn(`[STEP 1] Could not cancel pending cycle job ${jobId}: ${summarizeError(cancelError)}`);
            }
        }
    } catch (pendingJobsError) {
        console.warn(`[STEP 1] Could not inspect pending cycle jobs: ${summarizeError(pendingJobsError)}`);
    }

    try {
        const scheduledRunId = await scheduleRunAtWithRetries(
            ctx,
            "Curation outage retry",
            nextRunAt,
            internal.research.runResearchCycle,
            { attempt: Math.min(attempt + 1, CURATION_OUTAGE_RETRY_DELAYS_MS.length - 1) },
        );
        await ctx.runMutation(internal.api.setNextRunAt, {
            nextRunAt,
            lastCycleInterval: delayHours,
            schedulingReason: `News feed discovery unavailable; automatic retry in ${delayHours}h`,
            scheduledRunId,
        });
        console.warn(`[STEP 1] Scheduled curation outage retry in ${delayHours}h`);
        return { scheduled: true, nextRunAt, delayHours };
    } catch (scheduleError) {
        console.error(`[STEP 1] Failed to schedule curation outage retry: ${summarizeError(scheduleError)}`);
        return { scheduled: false };
    }
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

        if (stats.systemStatus === "stopped") {
            return { recovered: false, reason: "system stopped" };
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
        const recoveryReason = stats.isPaused
            ? "Automatic recovery cleared a stale cycle while scheduling remains paused"
            : "Automatic fallback scheduling after stuck/timed-out cycle; retrying in 24h";

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

        const scheduledRunId = stats.isPaused ? undefined : await (async () => {
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

        if (!stats.isPaused) {
            await ctx.runMutation(internal.api.setNextRunAt, {
                nextRunAt,
                lastCycleInterval: FALLBACK_INTERVAL_HOURS,
                schedulingReason: recoveryReason,
                scheduledRunId,
            });
        }

        const lockPrefix = stats.cycleRunId.slice(0, 8);
        const minsStuck = Math.round(cycleAgeMs / 60000);
        const errorLog = stats.isPaused
            ? `Recovery watchdog cleared stuck cycle ${lockPrefix} after ${minsStuck}m while scheduling remained paused.`
            : `Recovery watchdog cleared stuck cycle ${lockPrefix} after ${minsStuck}m; fallback next run set to 24h.`;

        await ctx.runMutation(internal.api.setStatus, {
            status: "online",
            errorLog,
        });

        await ctx.runMutation(internal.api.releaseCycleLock, { runId: stats.cycleRunId });

        console.warn(`🧯 [RECOVERY] Cleared stuck cycle ${lockPrefix} (${minsStuck}m old), set fallback next run in 24h.`);

        return {
            recovered: true,
            reason: errorLog,
            nextRunAt: stats.isPaused ? stats.nextRunAt : nextRunAt,
        };
    },
});


export const curateCambodia = internalAction({
    args: {},
    handler: async (ctx): Promise<{ newArticles: number; flagged: number; error?: string }> => {
        console.log(`🇰🇭 [CAMBODIA] Curating feed-backed news...`);

        const discovery = await collectCurationCandidates("cambodia");
        if (discovery.error) console.warn(`[CAMBODIA] Bing News discovery note: ${discovery.error}`);
        if (discovery.error && discovery.candidates.length === 0) throw new Error(`Bing News discovery failed: ${discovery.error}`);
        if (discovery.candidates.length === 0) return { newArticles: 0, flagged: 0 };
        return await insertFeedCandidates(ctx, "cambodia", discovery.candidates, "feed-backed curation");
    },
});

// =============================================================================
// STEP 1B: THAILAND NEWS CURATOR
// =============================================================================

export const curateThailand = internalAction({
    args: {},
    handler: async (ctx): Promise<{ newArticles: number; flagged: number; error?: string }> => {
        console.log(`🇹🇭 [THAILAND] Curating feed-backed news...`);

        const discovery = await collectCurationCandidates("thailand");
        if (discovery.error) console.warn(`[THAILAND] Bing News discovery note: ${discovery.error}`);
        if (discovery.error && discovery.candidates.length === 0) throw new Error(`Bing News discovery failed: ${discovery.error}`);
        if (discovery.candidates.length === 0) return { newArticles: 0, flagged: 0 };
        return await insertFeedCandidates(ctx, "thailand", discovery.candidates, "feed-backed curation");
    },
});

// =============================================================================
// STEP 1C: INTERNATIONAL NEWS CURATOR (3rd party sources)
// =============================================================================

export const curateInternational = internalAction({
    args: {},
    handler: async (ctx): Promise<{ newArticles: number; flagged: number; error?: string }> => {
        console.log(`🌍 [INTERNATIONAL] Curating feed-backed news...`);

        const discovery = await collectCurationCandidates("international");
        if (discovery.error) console.warn(`[INTERNATIONAL] Bing News discovery note: ${discovery.error}`);
        if (discovery.error && discovery.candidates.length === 0) throw new Error(`Bing News discovery failed: ${discovery.error}`);
        if (discovery.candidates.length === 0) return { newArticles: 0, flagged: 0 };
        return await insertFeedCandidates(ctx, "international", discovery.candidates, "feed-backed curation");
    },
});

function inferFeedFallbackCategory(candidate: CurationCandidate): "military" | "political" | "humanitarian" | "diplomatic" {
    const text = `${candidate.title} ${candidate.summary || ""}`.toLowerCase();
    if (/displac|evacuat|refugee|humanitarian|casualt|mine-clear|landmine/.test(text)) return "humanitarian";
    if (/ceasefire|agreement|talks?|negotiat|minister|diplomat|asean|united nations|\bun\b/.test(text)) return "diplomatic";
    if (/army|military|troop|soldier|clash|fight|attack|weapon|drone|artillery|border guard/.test(text)) return "military";
    return "political";
}

async function insertFeedCandidates(
    ctx: any,
    country: CurationCountry,
    candidates: CurationCandidate[],
    reason: string,
): Promise<{ newArticles: number; flagged: number }> {
    console.log(`[${country.toUpperCase()}] Inserting feed-backed candidates as unverified. reason=${reason}`);
    let addedCount = 0;
    let skippedCount = 0;

    for (const candidate of candidates) {
        const insertResult = await ctx.runMutation(internal.api.insertArticle, {
            perspective: country,
            title: candidate.title,
            titleEn: candidate.title,
            publishedAt: Date.parse(candidate.publishedAt),
            sourceUrl: candidate.sourceUrl,
            source: candidate.source || "Unknown",
            category: inferFeedFallbackCategory(candidate),
            credibility: 60,
            summary: candidate.summary || candidate.title,
            summaryEn: candidate.summary || candidate.title,
        });
        if (insertResult !== null) addedCount++;
        else skippedCount++;
    }

    console.log(`[${country.toUpperCase()}] Feed fallback added=${addedCount} skipped=${skippedCount}`);
    return { newArticles: addedCount, flagged: 0 };
}

type SynthesisSideLocalizations = {
    officialNarrative?: string;
    officialNarrativeEn?: string;
    officialNarrativeTh?: string;
    officialNarrativeKh?: string;
    postureLabel?: string;
    postureLabelEn?: string;
    postureLabelTh?: string;
    postureLabelKh?: string;
    postureRationale?: string;
    postureRationaleEn?: string;
    postureRationaleTh?: string;
    postureRationaleKh?: string;
};

type SynthesisNeutralLocalizations = {
    generalSummary?: string;
    generalSummaryEn?: string;
    generalSummaryTh?: string;
    generalSummaryKh?: string;
    keyEvents?: string[];
    keyEventsEn?: string[];
    keyEventsTh?: string[];
    keyEventsKh?: string[];
};

type SynthesisLocalizationShape = {
    cambodia?: SynthesisSideLocalizations;
    thailand?: SynthesisSideLocalizations;
    neutral?: SynthesisNeutralLocalizations;
};

async function repairSynthesisLocalizations(result: SynthesisLocalizationShape): Promise<void> {
    const items: LocalizedRepairItem[] = [];
    const setters = new Map<string, (thai?: string, khmer?: string) => void>();

    const addPair = (
        id: string,
        english: unknown,
        thai: unknown,
        khmer: unknown,
        setter: (thai?: string, khmer?: string) => void,
    ) => {
        if (typeof english !== "string" || !english.trim()) return;
        const normalizedThai = typeof thai === "string" ? normalizeLocalizedDigits(thai) : thai;
        const normalizedKhmer = typeof khmer === "string" ? normalizeLocalizedDigits(khmer) : khmer;
        if (typeof normalizedThai === "string" || typeof normalizedKhmer === "string") {
            setter(
                typeof normalizedThai === "string" ? normalizedThai : undefined,
                typeof normalizedKhmer === "string" ? normalizedKhmer : undefined,
            );
        }
        const repair: Array<"th" | "kh"> = [];
        if (!isValidLocalizedText(normalizedThai, "th")) repair.push("th");
        if (!isValidLocalizedText(normalizedKhmer, "kh")) repair.push("kh");
        if (repair.length === 0) return;
        items.push({
            id,
            english,
            repair,
        });
        setters.set(id, setter);
    };

    for (const side of ["cambodia", "thailand"] as const) {
        const section = result[side];
        if (!section) continue;
        addPair(
            `${side}:narrative`,
            section.officialNarrativeEn || section.officialNarrative,
            section.officialNarrativeTh,
            section.officialNarrativeKh,
            (thai, khmer) => {
                if (thai) section.officialNarrativeTh = thai;
                if (khmer) section.officialNarrativeKh = khmer;
            },
        );
        addPair(
            `${side}:posture-label`,
            section.postureLabelEn || section.postureLabel,
            section.postureLabelTh,
            section.postureLabelKh,
            (thai, khmer) => {
                if (thai) section.postureLabelTh = thai;
                if (khmer) section.postureLabelKh = khmer;
            },
        );
        addPair(
            `${side}:posture-rationale`,
            section.postureRationaleEn || section.postureRationale,
            section.postureRationaleTh,
            section.postureRationaleKh,
            (thai, khmer) => {
                if (thai) section.postureRationaleTh = thai;
                if (khmer) section.postureRationaleKh = khmer;
            },
        );
    }

    const neutral = result.neutral;
    if (neutral) {
        addPair(
            "neutral:summary",
            neutral.generalSummaryEn || neutral.generalSummary,
            neutral.generalSummaryTh,
            neutral.generalSummaryKh,
            (thai, khmer) => {
                if (thai) neutral.generalSummaryTh = thai;
                if (khmer) neutral.generalSummaryKh = khmer;
            },
        );

        const englishEvents = Array.isArray(neutral.keyEvents)
            ? neutral.keyEvents
            : Array.isArray(neutral.keyEventsEn) ? neutral.keyEventsEn : [];
        const thaiEvents = Array.isArray(neutral.keyEventsTh)
            ? neutral.keyEventsTh.slice(0, englishEvents.length)
            : [];
        const khmerEvents = Array.isArray(neutral.keyEventsKh)
            ? neutral.keyEventsKh.slice(0, englishEvents.length)
            : [];
        neutral.keyEventsTh = thaiEvents;
        neutral.keyEventsKh = khmerEvents;
        englishEvents.forEach((english, index) => {
            addPair(
                `neutral:event:${index}`,
                english,
                thaiEvents[index],
                khmerEvents[index],
                (thai, khmer) => {
                    if (thai) thaiEvents[index] = thai;
                    if (khmer) khmerEvents[index] = khmer;
                },
            );
        });
    }

    if (items.length === 0) return;
    const repaired = await repairLocalizedItems(items);
    let repairedFields = 0;
    for (const item of items) {
        const fixed = repaired.get(item.id);
        const setter = setters.get(item.id);
        if (!fixed || !setter) continue;
        setter(fixed.thai, fixed.khmer);
        if (fixed.thai) repairedFields++;
        if (fixed.khmer) repairedFields++;
    }
    console.warn(`[SYNTHESIS] localization_repair requestedFields=${items.reduce((sum, item) => sum + item.repair.length, 0)} repairedFields=${repairedFields}`);
}

// =============================================================================
// COMBINED SYNTHESIS (one Gemini request for all 3 analyses)
// =============================================================================

async function synthesizeAllInternal(ctx: any): Promise<any> {
        // ==================== TIMELINE CONTEXT (PRIMARY SOURCE) ====================
        // Timeline events are the verified, structured "memory" of the conflict
        const timeline = await ctx.runQuery(internal.api.getRecentTimeline, { limit: 12 });
        const timelineStats = await ctx.runQuery(internal.api.getTimelineStats, {});

        // Build timeline context using shared helper
        const timelineContext = timeline.length > 0
            ? timeline.map((e: any) => formatTimelineEvent(e)).join("\n\n")
            : "(No timeline events yet)";

        // ==================== STRATIFIED ARTICLE SAMPLING ====================
        // Timeline has verified/credible sources, so we DON'T need high-cred articles again.
        // Instead we focus on:
        // 1. LOW CREDIBILITY - to detect contested claims/spin without assuming falsehood
        // 2. BREAKING NEWS (most recent) - to catch current developments
        // This keeps context bounded even as DB grows to 1000s of articles.

        // PHASE 2 OPTIMIZATION: Use specialized indexed queries instead of fetching 300 articles
        // This reduces bandwidth by ~75-80% by fetching exactly what we need

        // ==================== LOW CREDIBILITY / PROPAGANDA (6 per country) ====================
        // Use new indexed query that sorts by credibility at database level
        const [cambodiaLowCred, thailandLowCred, internationalLowCred] = await Promise.all([
            ctx.runQuery(internal.api.getLowCredArticles, { country: "cambodia", limit: 2 }),
            ctx.runQuery(internal.api.getLowCredArticles, { country: "thailand", limit: 2 }),
            ctx.runQuery(internal.api.getLowCredArticles, { country: "international", limit: 2 }),
        ]);

        if (cambodiaLowCred.length === 0 && thailandLowCred.length === 0 && internationalLowCred.length === 0 && timeline.length === 0) {
            console.warn("[SYNTHESIS] skipped reason=no_articles_or_timeline");
            return null;
        }

        const lowCredByKey = new Map<string, (typeof cambodiaLowCred)[number] & { promptCountries: CurationCountry[] }>();
        for (const [country, articles] of [
            ["cambodia", cambodiaLowCred],
            ["thailand", thailandLowCred],
            ["international", internationalLowCred],
        ] as const) {
            for (const article of articles) {
                const key = canonicalizeArticleUrl(article.sourceUrl)
                    || `${article.source || ""}|${article.title || ""}`.toLowerCase().trim();
                const existing = lowCredByKey.get(key);
                if (existing) {
                    existing.promptCountries.push(country);
                    continue;
                }
                lowCredByKey.set(key, { ...article, promptCountries: [country] });
            }
        }
        const lowCredArticles = [...lowCredByKey.values()];

        const lowCredList = lowCredArticles.map((a, idx: number) =>
            `${idx + 1}. [${a.promptCountries.map((country: CurationCountry) => country.toUpperCase()).join("+")}] [${a.category}] "${a.title}" (${a.source}, cred:${a.credibility || 50})
   Summary: ${a.summary || "No summary"}`
        ).join("\n");

        // ==================== BREAKING NEWS (15 most recent across all) ====================
        // Use new indexed query that fetches from all tables and sorts by publishedAt
        const breakingNews: any[] = await ctx.runQuery(internal.api.getRecentBreakingNews, { limit: 8 });

        const breakingNewsList = breakingNews.map((a: any, idx: number) =>
            `${idx + 1}. [${a.country.toUpperCase()}] [${a.category}] "${a.title}" (${a.source}, cred:${a.credibility || 50})
   Summary: ${a.summary || "No summary"}`
        ).join("\n");

        console.log(`[SYNTHESIS] context timeline=${timeline.length} avgImportance=${timelineStats.avgImportance} lowCredRaw=kh:${cambodiaLowCred.length},th:${thailandLowCred.length},intl:${internationalLowCred.length} lowCredUnique=${lowCredArticles.length} breaking=${breakingNews.length}`);

        // Get previous analysis for context (MEMORY)
        const prevCambodia = await ctx.runQuery(api.api.getAnalysis, { target: "cambodia" }) as any;
        const prevThailand = await ctx.runQuery(api.api.getAnalysis, { target: "thailand" }) as any;
        const prevNeutral = await ctx.runQuery(api.api.getAnalysis, { target: "neutral" }) as any;
        const prevStats = await ctx.runQuery(api.api.getDashboardStats, {}) as any;

        const prompt: string = `You are the BorderClash synthesis analyst. Use only the supplied timeline and article records. Do not browse or search. Be neutral, concise, and explicit about uncertainty. Never invent a fact, source, casualty number, place, unit, or date.

Evidence rules:
- Prefer timeline events and higher-credibility articles.
- Treat government and domestic-media claims as claims unless corroborated.
- If sources disagree, say the point is disputed and attribute the competing claims.
- Do not call something verified or confirmed without naming the source that supports it.
- Keep the previous analysis when current evidence does not justify a change.

Posture rules:
- PEACEFUL intensity 0-30: diplomacy, routine patrols, no kinetic action.
- DEFENSIVE intensity 31-55: fortification, defensive response, holding positions.
- ESCALATED intensity 56-69: mobilization, forward deployment, serious military pressure.
- AGGRESSIVE intensity 70-100: cross-border strikes, offensive operations, territory seizure.
- territorialContext is one of OWN_TERRITORY, DISPUTED_ZONE, FOREIGN_TERRITORY, BORDER_ZONE when supported; otherwise omit it.

Dashboard rules:
- conflictLevel LOW means no armed fighting; ELEVATED means movements or minor clashes; CRITICAL means sustained combat or confirmed fatalities; UNCERTAIN means evidence conflicts.
- casualtyCount is cumulative fatalities and must never decrease.
- Change casualty, displaced, or injury values only when current supplied evidence supports the new number. Otherwise preserve the previous value.

Scheduling: choose 4-48 hours. Use 4-8 for active fighting, 12-24 for moving but non-kinetic conditions, and 24-48 for stable or diplomatic conditions.

${LOCALIZED_WRITING_RULES}

RECENT TIMELINE (${timeline.length} events):
${timelineContext}

LOW-CREDIBILITY ARTICLES (${lowCredArticles.length}; duplicate URLs merged):
${lowCredList || "(none)"}

RECENT BREAKING ARTICLES (${breakingNews.length}):
${breakingNewsList || "(none)"}

PREVIOUS ANALYSIS:
Cambodia: ${prevCambodia?.officialNarrative || "None"}
Thailand: ${prevThailand?.officialNarrative || "None"}
Neutral: ${prevNeutral?.generalSummary || "None"}
Posture: Cambodia=${prevCambodia?.militaryPosture || "unknown"}, Thailand=${prevThailand?.militaryPosture || "unknown"}
Previous dashboard: conflict=${prevStats?.conflictLevel || "LOW"}, casualties=${prevStats?.casualtyCount ?? 0}, displaced=${prevStats?.displacedCount ?? 0}, civilianInjured=${prevStats?.civilianInjuredCount ?? 0}, militaryInjured=${prevStats?.militaryInjuredCount ?? 0}

Return exactly one fenced \`\`\`json code block and nothing else. Use this shape:
\`\`\`json
{
  "cambodia": {
    "officialNarrative": "English, max 50 words",
    "officialNarrativeTh": "Thai translation",
    "officialNarrativeKh": "Khmer translation",
    "narrativeSource": "Main supplied source names",
    "militaryIntensity": 0,
    "militaryPosture": "PEACEFUL|DEFENSIVE|ESCALATED|AGGRESSIVE",
    "postureLabel": "max 4 words",
    "postureLabelTh": "Thai label",
    "postureLabelKh": "Khmer label",
    "postureRationale": "English, 1-2 short sentences",
    "postureRationaleTh": "Thai translation",
    "postureRationaleKh": "Khmer translation",
    "territorialContext": "OWN_TERRITORY|DISPUTED_ZONE|FOREIGN_TERRITORY|BORDER_ZONE"
  },
  "thailand": {
    "officialNarrative": "English, max 50 words",
    "officialNarrativeTh": "Thai translation",
    "officialNarrativeKh": "Khmer translation",
    "narrativeSource": "Main supplied source names",
    "militaryIntensity": 0,
    "militaryPosture": "PEACEFUL|DEFENSIVE|ESCALATED|AGGRESSIVE",
    "postureLabel": "max 4 words",
    "postureLabelTh": "Thai label",
    "postureLabelKh": "Khmer label",
    "postureRationale": "English, 1-2 short sentences",
    "postureRationaleTh": "Thai translation",
    "postureRationaleKh": "Khmer translation",
    "territorialContext": "OWN_TERRITORY|DISPUTED_ZONE|FOREIGN_TERRITORY|BORDER_ZONE"
  },
  "neutral": {
    "generalSummary": "English, 50-80 words",
    "generalSummaryTh": "Thai translation",
    "generalSummaryKh": "Khmer translation",
    "conflictLevel": "Low|Elevated|Critical|Uncertain",
    "keyEvents": ["2-5 neutral English headlines, max 12 words each"],
    "keyEventsTh": ["Thai translations in the same order"],
    "keyEventsKh": ["Khmer translations in the same order"]
  },
  "scheduling": {
    "nextCycleHours": 24,
    "reason": "One short sentence"
  },
  "dashboard": {
    "conflictLevel": "LOW|ELEVATED|CRITICAL|UNCERTAIN",
    "casualtyCount": ${prevStats?.casualtyCount ?? 0},
    "displacedCount": ${prevStats?.displacedCount ?? 0},
    "civilianInjuredCount": ${prevStats?.civilianInjuredCount ?? 0},
    "militaryInjuredCount": ${prevStats?.militaryInjuredCount ?? 0}
  }
}
\`\`\`
`;
        console.log(`[SYNTHESIS] request promptChars=${prompt.length}`);

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
            }>(prompt, { thinkingLevel: GEMINI_THINKING.synthesis }, 2, "SYNTHESIS");

            if (!result) {
                console.warn("[SYNTHESIS] skipped reason=invalid_or_missing_json preservedExisting=true");
                // Return null to indicate failure, but existing analysis tables remain untouched
                // This is intentional: we never overwrite good data with nothing
                return null;
            }

            await repairSynthesisLocalizations(result);

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
}

export const synthesizeAll = internalAction({
    args: {},
    handler: async (ctx): Promise<any> => synthesizeAllInternal(ctx),
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
            }>(prompt, {
                thinkingLevel: GEMINI_THINKING.manager,
                useSearch: true,
            }, 2, "MANAGER");

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
        if (stats?.isPaused || stats?.systemStatus === "stopped") {
            console.log("[CYCLE] skipped reason=paused_or_stopped");
            if (stats?.isPaused && stats?.systemStatus !== "stopped") {
                await ctx.runMutation(internal.api.setStatus, { status: "online" });
            }
            await ctx.runMutation(internal.api.releaseCycleLock, { runId });
            return;
        }
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
            cambodiaResult = await ctx.runAction(internal.research.curateCambodia, {});
            await sleep(2000);
        } catch (e) {
            console.error("[STEP 1] cambodia_curation_failed", e);
            errors.push(`Cambodia: ${summarizeError(e)}`);
        }

        try {
            thailandResult = await ctx.runAction(internal.research.curateThailand, {});
            await sleep(2000);
        } catch (e) {
            console.error("[STEP 1] thailand_curation_failed", e);
            errors.push(`Thailand: ${summarizeError(e)}`);
        }

        try {
            internationalResult = await ctx.runAction(internal.research.curateInternational, {});
            await sleep(2000);
        } catch (e) {
            console.error("[STEP 1] international_curation_failed", e);
            errors.push(`International: ${summarizeError(e)}`);
        }

        console.log(`[STEP 1] complete cambodia=${curationSummary(cambodiaResult)} thailand=${curationSummary(thailandResult)} international=${curationSummary(internationalResult)} errors=${errors.length}`);

        // If all curation failed, abort the chain
        if (errors.length >= 3) {
            console.error("[STEP 1] all_curation_failed aborting=true");
            const outageRetry = await scheduleCurationOutageRetry(ctx, attempt);
            await ctx.runMutation(internal.api.setStatus, {
                status: outageRetry.scheduled ? "online" : "error",
                errorLog: outageRetry.scheduled
                    ? `Curation failed completely; automatic retry scheduled in ${outageRetry.delayHours}h`
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
            if (stats?.isPaused && stats?.systemStatus !== "stopped") {
                await ctx.runMutation(internal.api.setStatus, { status: "online" });
            }
            await ctx.runMutation(internal.api.releaseCycleLock, { runId });
            return;
        }
        if (!stats || stats.cycleRunId !== runId || stats.systemStatus !== "syncing") {
            console.warn(`[STEP 2] skipped stale_run runId=${runId} activeRunId=${stats?.cycleRunId ?? "none"} status=${stats?.systemStatus ?? "missing"}`);
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
            if (verifyResult.errors > 0) {
                stepErrors.push(`Verification: ${verifyResult.errors} article(s) left unverified`);
            }
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
            if (stats?.isPaused && stats?.systemStatus !== "stopped") {
                await ctx.runMutation(internal.api.setStatus, { status: "online" });
            }
            await ctx.runMutation(internal.api.releaseCycleLock, { runId });
            return;
        }
        if (!stats || stats.cycleRunId !== runId || stats.systemStatus !== "syncing") {
            console.warn(`[STEP 3] skipped stale_run runId=${runId} activeRunId=${stats?.cycleRunId ?? "none"} status=${stats?.systemStatus ?? "missing"}`);
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

        try {
            while (historianLoops < MAX_HISTORIAN_LOOPS) {
                const timeRemaining = getTimeRemaining();
                if (timeRemaining < 90 * 1000) { // 90s minimum
                    historianStopReason = `time_budget_low:${Math.round(timeRemaining / 1000)}s`;
                    break;
                }

                historianLoops++;

                const latestTimeline = await runWithRetries(
                    `[STEP 3] Timeline refresh iteration ${historianLoops}`,
                    () => ctx.runQuery(internal.api.getRecentTimelineContextForHistorian, { limit: 12 }),
                );

                const result = await runWithRetries(
                    `[STEP 3] Historian iteration ${historianLoops}`,
                    () => runHistorianCycleInternal(ctx, {
                        cachedTimeline: latestTimeline,
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

        console.log(`[STEP 3] complete loops=${historianLoops} processed=${historianProcessed} created=${historianEventsCreated} updated=${historianEventsUpdated} deleted=${historianEventsDeleted} merged=${historianSourcesMerged} archived=${historianArchived} discarded=${historianDiscarded} stop=${historianStopReason} accumulatedErrors=${stepErrors.length}`);

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
            if (stats?.isPaused && stats?.systemStatus !== "stopped") {
                await ctx.runMutation(internal.api.setStatus, { status: "online" });
            }
            await ctx.runMutation(internal.api.releaseCycleLock, { runId });
            return;
        }
        if (!stats || stats.cycleRunId !== runId || stats.systemStatus !== "syncing") {
            console.warn(`[STEP 4] skipped stale_run runId=${runId} activeRunId=${stats?.cycleRunId ?? "none"} status=${stats?.systemStatus ?? "missing"}`);
            return;
        }
        const stepErrors = [...errors];
        let schedulingResult: { nextCycleHours: number; reason: string } | null = null;
        let synthesisSucceeded = false;
        let dashboardUpdated = false;
        let fallbackSnapshotPublished = false;
        let synthesisWriteErrors = 0;

        // A previous Step 4 action can hit Convex's action boundary while the
        // already-started Gemini job finishes moments later and writes the
        // dashboard. Scheduled retries run with the same cycle runId. If this
        // cycle has already published a newer dashboard, finalize the cycle
        // instead of starting duplicate synthesis work.
        if (attempt > 0 && typeof stats.lastResearchAt === "number") {
            const currentDashboard = await ctx.runQuery(api.api.getDashboardStats, {}) as any;
            if (
                typeof currentDashboard?.lastUpdatedAt === "number"
                && currentDashboard.lastUpdatedAt > stats.lastResearchAt
            ) {
                synthesisSucceeded = true;
                dashboardUpdated = true;
                console.log(
                    `[STEP 4] late_synthesis_already_published dashboardAt=${new Date(currentDashboard.lastUpdatedAt).toISOString()} cycleStartedAt=${new Date(stats.lastResearchAt).toISOString()}`,
                );
            }
        }

        try {
            if (synthesisSucceeded) {
                // The earlier invocation already wrote the result. Continue to
                // scheduling/status/lock finalization below.
            } else {
            const result = await runWithRetries(
                "[STEP 4] Synthesis",
                () => synthesizeAllInternal(ctx),
            );
            if (!result) {
                console.warn("[STEP 4] synthesis_returned_no_result dashboardMayBeUnchanged=true");
                const scheduledRetry = await scheduleStepRetry(ctx, {
                    stepName: "STEP 4",
                    actionReference: internal.research.step4_synthesis,
                    args: { errors: stepErrors, runId },
                    attempt,
                });
                if (scheduledRetry) {
                    console.warn("[STEP 4] synthesis_unavailable retrying_step_without_rerunning_research=true");
                    return;
                }
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

        // Synthesis may be unavailable while the deterministic feed, source
        // verification, and historian steps still changed the database. Publish
        // those current records with the previous analysis intact instead of
        // leaving the public snapshot stale until Gemini recovers.
        if (!synthesisSucceeded) {
            try {
                await ctx.runMutation(internal.api.publishDashboardSnapshot, {});
                fallbackSnapshotPublished = true;
                console.log("[STEP 4] Published fallback dashboard snapshot with previous analysis");
            } catch (e) {
                const snapshotError = `SnapshotFallback: ${summarizeError(e)}`;
                stepErrors.push(snapshotError);
                console.error(`[STEP 4] fallback_snapshot_failed error=${summarizeError(e)}`);
            }
        }

        // ═══ ADAPTIVE SCHEDULING with scheduler.runAt ═══
        // Schedule exact next run time (no more heartbeat polling!)
        const DEFAULT_INTERVAL_HOURS = 12;
        // A failed synthesis is usually an upstream Gemini outage, not a sign
        // that the border is quiet. Retry on the normal minimum interval so a
        // transient provider incident cannot leave the dashboard stale for a
        // full day.
        const SYNTHESIS_FALLBACK_INTERVAL_HOURS = 4;
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
                ? "Gemini synthesis unavailable; operational retry in 4h"
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
        console.log(`[STEP 4] complete synthesisOk=${synthesisSucceeded} dashboardUpdated=${dashboardUpdated} fallbackSnapshot=${fallbackSnapshotPublished} writeErrors=${synthesisWriteErrors} nextRunHours=${clampedHours} nextRunAt=${new Date(nextRunAt).toISOString()} scheduledRunId=${scheduledRunId ?? "none"} cancelledPendingJobs=${cancelledPendingJobs} cancelFailures=${pendingCancelFailures} reason="${shortReason}" accumulatedErrors=${stepErrors.length}`);

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
 * Verify queued sources using evidence BorderClash fetches itself.
 * Strong direct-page or same-publisher RSS matches are marked verified;
 * explicit 404/410 responses are removed; ambiguous evidence is preserved.
 * Gemini is intentionally not part of this step.
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

                // Fetch evidence ourselves. Gemini does not need browsing access for
                // source verification and must judge only the evidence we retrieved.
                const evidenceBatch = await Promise.all(batch.map((article) =>
                    collectSourceEvidence(article.sourceUrl || "", article.title || "")
                ));

                // Verification is deterministic. BorderClash already fetched the
                // publisher page and independent RSS evidence, so do not spend a
                // Gemini browser request on a decision we can make conservatively.
                const results = evidenceBatch.map((evidence, index) => ({
                    articleIndex: index + 1,
                    ...assessSourceEvidence(evidence, {
                        title: batch[index].title || "",
                        summary: batch[index].summary || batch[index].summaryEn,
                        source: batch[index].source,
                        sourceUrl: batch[index].sourceUrl || "",
                    }),
                }));

                for (const r of results) {
                    const articleIndex = r.articleIndex - 1;
                    const article = batch[articleIndex];
                    if (!article) {
                        errors++;
                        continue;
                    }

                    try {
                        if (r.status === "VERIFIED") {
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
                                console.log(`   DUPLICATE: "${article.title}" -> "${duplicate.duplicateTitle}" (${duplicate.reason})`);
                                continue;
                            }

                            await ctx.runMutation(internal.api.markSourceVerified, {
                                title: article.title,
                                country: article.country,
                            });
                            article.sourceVerifiedAt = Date.now();
                            article.status = "active";
                            verified++;
                            console.log(`   VERIFIED: "${article.title?.substring(0, 70)}" match=${r.matchScore}% reason=${r.reason}`);
                            continue;
                        }

                        if (r.status === "URL_DEAD") {
                            await ctx.runMutation(internal.api.deleteArticle, {
                                title: article.title,
                                country: article.country,
                            });
                            deleted++;
                            console.log(`   URL_DEAD: deleted "${article.title?.substring(0, 70)}" reason=${r.reason}`);
                            continue;
                        }

                        // Ambiguous/blocked evidence is preserved and remains queued for
                        // a later cycle. Never delete or rewrite content on a weak match.
                        errors++;
                        console.log(`   SKIP: "${article.title?.substring(0, 70)}" match=${r.matchScore}% reason=${r.reason}`);
                    } catch (resultError) {
                        console.log(`   Error processing verification result for "${article.title?.substring(0, 40)}...": ${resultError}`);
                        errors++;
                    }
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
        console.log(`[SINGLE VERIFY] Checking: ${args.url}`);
        const evidence = await collectSourceEvidence(args.url, args.storedTitle);
        const result = assessSourceEvidence(evidence, {
            title: args.storedTitle,
            summary: args.storedSummary,
            sourceUrl: args.url,
        });
        return {
            status: result.status,
            actualTitle: result.actualTitle,
            actualTopic: result.actualSummary,
            matchScore: result.matchScore,
            reason: result.reason,
        };
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
            const country = p as CurationCountry;
            console.log(`Backfilling ${country.toUpperCase()} for ${targetDate}...`);

            try {
                const discovery = await collectCurationCandidates(country, { targetDate });
                if (discovery.error) {
                    console.warn(`[MANUAL BACKFILL] ${country} discovery note: ${discovery.error}`);
                }

                const existing = await ctx.runQuery(internal.api.getExistingTitlesInternal, { country });
                const existingUrls = new Set(
                    Array.isArray(existing)
                        ? existing.map((article: any) => article.sourceUrl).filter(Boolean)
                        : [],
                );
                const candidates = discovery.candidates.filter(candidate => !existingUrls.has(candidate.sourceUrl));
                if (candidates.length === 0) {
                    results_summary.push(`${country}: +0`);
                    continue;
                }

                const result = await insertFeedCandidates(ctx, country, candidates, "manual feed backfill");
                results_summary.push(`${country}: +${result.newArticles}`);
            } catch (err: any) {
                console.error(`[MANUAL BACKFILL] Error for ${country}: ${err.message}`);
                results_summary.push(`${country}: ERROR`);
            }
        }

        // Reset the auto-cycle timer since we just did a manual run
        await ctx.runMutation(internal.api.setSkipNextCycle, {});

        console.log(`✅ [MANUAL BACKFILL] Completed ${targetDate}: ${results_summary.join(", ")}`);
        return `Backfill Complete for ${targetDate}: ${results_summary.join(", ")}`;
    }
});
