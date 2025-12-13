import { query, mutation, internalMutation, internalQuery, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// =============================================================================
// PUBLIC QUERIES (Frontend)
// =============================================================================

export const getNews = query({
    args: {
        country: v.union(v.literal("thailand"), v.literal("cambodia")),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const table = args.country === "thailand" ? "thailandNews" : "cambodiaNews";
        // Show both verified (active) and unverified articles
        const articles = await ctx.db
            .query(table)
            .order("desc")
            .take(args.limit ?? 50);
        // Filter to only show active or unverified (not false, outdated, archived)
        return articles.filter(a => a.status === "active" || a.status === "unverified");
    },
});

export const getAnalysis = query({
    args: {
        target: v.union(v.literal("thailand"), v.literal("cambodia"), v.literal("neutral")),
    },
    handler: async (ctx, args) => {
        if (args.target === "neutral") {
            return await ctx.db.query("neutralAnalysis").order("desc").first();
        }
        const table = args.target === "thailand" ? "thailandAnalysis" : "cambodiaAnalysis";
        return await ctx.db.query(table).order("desc").first();
    },
});

export const getStats = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("systemStats")
            .withIndex("by_key", (q) => q.eq("key", "main"))
            .first();
    },
});

export const getSystemStatsInternal = internalQuery({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("systemStats")
            .withIndex("by_key", (q) => q.eq("key", "main"))
            .first();
    },
});

// Dashboard stats - SEPARATE from synthesis analysis
// This returns live stats from updateDashboard (casualties, displaced, etc.)
export const getDashboardStats = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("dashboardStats")
            .withIndex("by_key", (q) => q.eq("key", "main"))
            .first();
    },
});

export const getArticleCounts = query({
    args: {},
    handler: async (ctx) => {
        // Count all articles (active + unverified), not just active
        const thailandAll = await ctx.db.query("thailandNews").collect();
        const cambodiaAll = await ctx.db.query("cambodiaNews").collect();
        const internationalAll = await ctx.db.query("internationalNews").collect();

        // Filter to show active + unverified (not false/outdated/archived)
        const thailand = thailandAll.filter(a => a.status === "active" || a.status === "unverified").length;
        const cambodia = cambodiaAll.filter(a => a.status === "active" || a.status === "unverified").length;
        const international = internationalAll.filter(a => a.status === "active" || a.status === "unverified").length;

        return {
            thailand,
            cambodia,
            international,
            total: thailand + cambodia + international,
        };
    },
});

// =============================================================================
// INTERNAL QUERIES (Research Agent)
// =============================================================================

export const getExistingTitlesInternal = internalQuery({
    args: { country: v.union(v.literal("thailand"), v.literal("cambodia"), v.literal("international")) },
    handler: async (ctx, args) => {
        const table = args.country === "thailand" ? "thailandNews"
            : args.country === "cambodia" ? "cambodiaNews"
                : "internationalNews";
        const articles = await ctx.db.query(table).collect();
        return articles.map(a => ({ title: a.title, source: a.source, sourceUrl: a.sourceUrl }));
    },
});

export const getNewsInternal = internalQuery({
    args: {
        country: v.union(v.literal("thailand"), v.literal("cambodia"), v.literal("international")),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const table = args.country === "thailand" ? "thailandNews"
            : args.country === "cambodia" ? "cambodiaNews"
                : "internationalNews";
        // Get all articles and filter to active + unverified
        const allArticles = await ctx.db
            .query(table)
            .collect();

        const now = Date.now();
        const ONE_DAY = 24 * 60 * 60 * 1000;

        return allArticles
            .filter(a => a.status === "active" || a.status === "unverified")
            .sort((a, b) => {
                // Hybrid score: 70% recency + 30% credibility
                const ageA = Math.min((now - (a.publishedAt || a.fetchedAt)) / ONE_DAY, 7); // Cap at 7 days
                const ageB = Math.min((now - (b.publishedAt || b.fetchedAt)) / ONE_DAY, 7);
                const recencyScoreA = 100 - (ageA / 7) * 100; // 100 = today, 0 = 7+ days old
                const recencyScoreB = 100 - (ageB / 7) * 100;
                const credA = a.credibility || 50;
                const credB = b.credibility || 50;
                const scoreA = recencyScoreA * 0.7 + credA * 0.3;
                const scoreB = recencyScoreB * 0.7 + credB * 0.3;
                return scoreB - scoreA; // Highest score first
            })
            .slice(0, args.limit ?? 50);
    },
});

// =============================================================================
// INTERNAL MUTATIONS (Research Agent)
// =============================================================================

export const insertArticle = internalMutation({
    args: {
        perspective: v.union(v.literal("thailand"), v.literal("cambodia"), v.literal("international")),
        title: v.string(),
        titleEn: v.optional(v.string()),
        titleTh: v.optional(v.string()),
        titleKh: v.optional(v.string()),
        publishedAt: v.number(),
        sourceUrl: v.string(),
        source: v.string(),
        category: v.union(v.literal("military"), v.literal("political"), v.literal("humanitarian"), v.literal("diplomatic")),
        credibility: v.number(),
        summary: v.optional(v.string()),
        summaryEn: v.optional(v.string()),
        summaryTh: v.optional(v.string()),
        summaryKh: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const table = args.perspective === "thailand" ? "thailandNews"
            : args.perspective === "cambodia" ? "cambodiaNews"
                : "internationalNews";

        const existing = await ctx.db
            .query(table)
            .withIndex("by_url", (q) => q.eq("sourceUrl", args.sourceUrl))
            .first();

        if (existing) {
            console.log(`Skipping duplicate (URL match): "${args.title}"`);
            return null;
        }

        // Secondary check by title if URL is different but title is identical
        const existingTitle = await ctx.db
            .query(table)
            .withIndex("by_title", (q) => q.eq("title", args.title))
            .first();

        if (existingTitle) {
            console.log(`Skipping duplicate (Title match): "${args.title}"`);
            return null;
        }

        const newId = await ctx.db.insert(table, {
            title: args.title,
            titleEn: args.titleEn,
            titleTh: args.titleTh,
            titleKh: args.titleKh,
            publishedAt: args.publishedAt,
            sourceUrl: args.sourceUrl,
            source: args.source,
            category: args.category,
            credibility: args.credibility,
            status: "unverified",
            summary: args.summary,
            summaryEn: args.summaryEn,
            summaryTh: args.summaryTh,
            summaryKh: args.summaryKh,
            fetchedAt: Date.now(),
        });

        const stats = await ctx.db.query("systemStats")
            .withIndex("by_key", (q) => q.eq("key", "main"))
            .first();

        if (stats) {
            await ctx.db.patch(stats._id, {
                totalArticlesFetched: (stats.totalArticlesFetched || 0) + 1
            });
        }

        return newId;
    },
});

export const flagArticle = internalMutation({
    args: {
        country: v.union(v.literal("thailand"), v.literal("cambodia"), v.literal("international")),
        title: v.string(),
        status: v.union(
            v.literal("outdated"),
            v.literal("unverified"),
            v.literal("false"),
            v.literal("archived")
        ),
    },
    handler: async (ctx, args) => {
        const table = args.country === "thailand" ? "thailandNews"
            : args.country === "cambodia" ? "cambodiaNews"
                : "internationalNews";

        const article = await ctx.db
            .query(table)
            .withIndex("by_title", (q) => q.eq("title", args.title))
            .first();

        if (article) {
            await ctx.db.patch(article._id, { status: args.status });
            console.log(`Flagged "${args.title}" as ${args.status}`);
        }
    },
});

export const deleteArticle = internalMutation({
    args: {
        country: v.union(v.literal("thailand"), v.literal("cambodia"), v.literal("international")),
        title: v.string(),
        reason: v.optional(v.string()) // Just for logging
    },
    handler: async (ctx, args) => {
        const table = args.country === "thailand" ? "thailandNews"
            : args.country === "cambodia" ? "cambodiaNews"
                : "internationalNews";

        const article = await ctx.db
            .query(table)
            .withIndex("by_title", (q) => q.eq("title", args.title))
            .first();

        if (article) {
            await ctx.db.delete(article._id);
            console.log(`🗑️ DELETED article: "${args.title}" (${args.reason || "No reason given"})`);
        } else {
            console.log(`⚠️ Could not find article to delete: "${args.title}"`);
        }
    },
});

export const updateArticleCredibility = internalMutation({
    args: {
        country: v.union(v.literal("thailand"), v.literal("cambodia"), v.literal("international")),
        title: v.string(),
        credibility: v.number(),
    },
    handler: async (ctx, args) => {
        const table = args.country === "thailand" ? "thailandNews"
            : args.country === "cambodia" ? "cambodiaNews"
                : "internationalNews";

        const article = await ctx.db
            .query(table)
            .withIndex("by_title", (q) => q.eq("title", args.title))
            .first();

        if (article) {
            await ctx.db.patch(article._id, { credibility: args.credibility });
            console.log(`Updated credibility for "${args.title}" to ${args.credibility}`);
        }
    },
});

export const upsertAnalysis = internalMutation({
    args: {
        target: v.union(v.literal("thailand"), v.literal("cambodia"), v.literal("neutral")),

        // Country fields
        officialNarrative: v.optional(v.string()),
        officialNarrativeEn: v.optional(v.string()),
        officialNarrativeTh: v.optional(v.string()),
        officialNarrativeKh: v.optional(v.string()),
        narrativeSource: v.optional(v.string()),
        militaryIntensity: v.optional(v.number()),
        militaryPosture: v.optional(v.union(v.literal("PEACEFUL"), v.literal("DEFENSIVE"), v.literal("AGGRESSIVE"))),
        // Detailed posture context with translations
        postureLabel: v.optional(v.string()),
        postureLabelEn: v.optional(v.string()),
        postureLabelTh: v.optional(v.string()),
        postureLabelKh: v.optional(v.string()),
        postureRationale: v.optional(v.string()),
        postureRationaleEn: v.optional(v.string()),
        postureRationaleTh: v.optional(v.string()),
        postureRationaleKh: v.optional(v.string()),
        territorialContext: v.optional(v.union(
            v.literal("OWN_TERRITORY"),
            v.literal("DISPUTED_ZONE"),
            v.literal("FOREIGN_TERRITORY"),
            v.literal("BORDER_ZONE")
        )),

        // Neutral fields
        generalSummary: v.optional(v.string()),
        generalSummaryEn: v.optional(v.string()),
        generalSummaryTh: v.optional(v.string()),
        generalSummaryKh: v.optional(v.string()),
        conflictLevel: v.optional(v.string()),
        keyEvents: v.optional(v.array(v.string())),
        keyEventsEn: v.optional(v.array(v.string())),
        keyEventsTh: v.optional(v.array(v.string())),
        keyEventsKh: v.optional(v.array(v.string())),
        // Stats
        displacedCount: v.optional(v.number()),
        displacedTrend: v.optional(v.number()),  // % change from 1 week ago
        civilianInjuredCount: v.optional(v.number()),
        militaryInjuredCount: v.optional(v.number()),
        injuredCount: v.optional(v.number()),  // Legacy total
        casualtyCount: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        if (args.target === "neutral") {
            const existing = await ctx.db.query("neutralAnalysis").order("desc").first();
            const data = {
                generalSummary: args.generalSummary ?? "",
                generalSummaryEn: args.generalSummaryEn,
                generalSummaryTh: args.generalSummaryTh,
                generalSummaryKh: args.generalSummaryKh,
                conflictLevel: args.conflictLevel ?? "Low",
                keyEvents: args.keyEvents ?? [],
                keyEventsEn: args.keyEventsEn,
                keyEventsTh: args.keyEventsTh,
                keyEventsKh: args.keyEventsKh,
                displacedCount: args.displacedCount ?? 0,
                displacedTrend: args.displacedTrend ?? 0,
                civilianInjuredCount: args.civilianInjuredCount ?? 0,
                militaryInjuredCount: args.militaryInjuredCount ?? 0,
                injuredCount: args.injuredCount ?? 0,
                casualtyCount: args.casualtyCount ?? 0,
                lastUpdatedAt: Date.now(),
            };

            if (existing) await ctx.db.patch(existing._id, data);
            else await ctx.db.insert("neutralAnalysis", data);

        } else {
            const table = args.target === "thailand" ? "thailandAnalysis" : "cambodiaAnalysis";
            const existing = await ctx.db.query(table).order("desc").first();
            const data = {
                officialNarrative: args.officialNarrative ?? "",
                officialNarrativeEn: args.officialNarrativeEn,
                officialNarrativeTh: args.officialNarrativeTh,
                officialNarrativeKh: args.officialNarrativeKh,
                narrativeSource: args.narrativeSource ?? "",
                militaryIntensity: args.militaryIntensity ?? 0,
                militaryPosture: args.militaryPosture ?? "DEFENSIVE",
                // Detailed posture context with translations
                postureLabel: args.postureLabel,
                postureLabelEn: args.postureLabelEn,
                postureLabelTh: args.postureLabelTh,
                postureLabelKh: args.postureLabelKh,
                postureRationale: args.postureRationale,
                postureRationaleEn: args.postureRationaleEn,
                postureRationaleTh: args.postureRationaleTh,
                postureRationaleKh: args.postureRationaleKh,
                territorialContext: args.territorialContext,
                lastUpdatedAt: Date.now(),
            };

            if (existing) await ctx.db.patch(existing._id, data);
            else await ctx.db.insert(table, data);
        }
    },
});

// Dashboard stats mutation - SEPARATE from synthesis analysis
export const upsertDashboardStats = internalMutation({
    args: {
        conflictLevel: v.string(),
        summary: v.optional(v.string()),
        displacedCount: v.number(),
        displacedTrend: v.number(),
        civilianInjuredCount: v.number(),
        militaryInjuredCount: v.number(),
        casualtyCount: v.number(),
    },
    handler: async (ctx, args) => {
        const now = Date.now();

        // 1. Update the "current" stats (main record for frontend)
        const existing = await ctx.db
            .query("dashboardStats")
            .withIndex("by_key", (q) => q.eq("key", "main"))
            .first();

        const data = {
            key: "main" as const,
            conflictLevel: args.conflictLevel,
            summary: args.summary,
            displacedCount: args.displacedCount,
            displacedTrend: args.displacedTrend,
            civilianInjuredCount: args.civilianInjuredCount,
            militaryInjuredCount: args.militaryInjuredCount,
            casualtyCount: args.casualtyCount,
            lastUpdatedAt: now,
        };

        if (existing) {
            await ctx.db.patch(existing._id, data);
        } else {
            await ctx.db.insert("dashboardStats", data);
        }

        // 2. Also insert a history record for trend tracking
        await ctx.db.insert("dashboardHistory", {
            conflictLevel: args.conflictLevel,
            summary: args.summary,
            displacedCount: args.displacedCount,
            displacedTrend: args.displacedTrend,
            civilianInjuredCount: args.civilianInjuredCount,
            militaryInjuredCount: args.militaryInjuredCount,
            casualtyCount: args.casualtyCount,
            recordedAt: now,
        });

        console.log(`📊 [DASHBOARD] Updated stats + added history entry`);
    },
});


export const setStatus = internalMutation({
    args: {
        status: v.union(v.literal("online"), v.literal("syncing"), v.literal("error"), v.literal("stopped")),
        errorLog: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db.query("systemStats")
            .withIndex("by_key", (q) => q.eq("key", "main"))
            .first();

        const data = {
            systemStatus: args.status,
            lastResearchAt: Date.now(),
            ...(args.errorLog !== undefined && { errorLog: args.errorLog }),
        };

        if (existing) {
            await ctx.db.patch(existing._id, data);
        } else {
            await ctx.db.insert("systemStats", {
                key: "main",
                totalArticlesFetched: 0,
                ...data
            });
        }
    },
});

export const pauseTimer = mutation({
    args: {},
    handler: async (ctx) => {
        const existing = await ctx.db.query("systemStats")
            .withIndex("by_key", (q) => q.eq("key", "main"))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, { isPaused: true });
        }
    },
});

export const resumeTimer = mutation({
    args: {},
    handler: async (ctx) => {
        const existing = await ctx.db.query("systemStats")
            .withIndex("by_key", (q) => q.eq("key", "main"))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, { isPaused: false });
        }
    },
});

export const stopResearchCycle = mutation({
    args: {},
    handler: async (ctx) => {
        console.log("🛑 EMERGENCY STOP: Stopping research cycle...");
        const existing = await ctx.db.query("systemStats")
            .withIndex("by_key", (q) => q.eq("key", "main"))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, {
                isPaused: true,
                systemStatus: "stopped",
                errorLog: "Cycle manually stopped by user."
            });
        }
    },
});

export const clearAllData = mutation({
    args: {},
    handler: async (ctx) => {
        const thaiArticles = await ctx.db.query("thailandNews").collect();
        for (const a of thaiArticles) await ctx.db.delete(a._id);

        const khmerArticles = await ctx.db.query("cambodiaNews").collect();
        for (const a of khmerArticles) await ctx.db.delete(a._id);

        const tAnalysis = await ctx.db.query("thailandAnalysis").collect();
        for (const a of tAnalysis) await ctx.db.delete(a._id);

        const cAnalysis = await ctx.db.query("cambodiaAnalysis").collect();
        for (const a of cAnalysis) await ctx.db.delete(a._id);

        const nAnalysis = await ctx.db.query("neutralAnalysis").collect();
        for (const a of nAnalysis) await ctx.db.delete(a._id);

        return { success: true };
    },
});

// Reset all articles to unverified status - allows re-running validation from scratch
export const resetAllValidation = mutation({
    args: {},
    handler: async (ctx) => {
        console.log("🔄 Resetting all validation status...");

        let resetCount = 0;

        // Reset Thailand articles
        const thai = await ctx.db.query("thailandNews").collect();
        for (const a of thai) {
            await ctx.db.patch(a._id, {
                status: "unverified",
                lastReviewedAt: undefined,
                hasConflict: undefined,
                conflictsWith: undefined,
                nextReviewAt: undefined,
            });
            resetCount++;
        }

        // Reset Cambodia articles
        const cambo = await ctx.db.query("cambodiaNews").collect();
        for (const a of cambo) {
            await ctx.db.patch(a._id, {
                status: "unverified",
                lastReviewedAt: undefined,
                hasConflict: undefined,
                conflictsWith: undefined,
                nextReviewAt: undefined,
            });
            resetCount++;
        }

        // Reset International articles
        const intl = await ctx.db.query("internationalNews").collect();
        for (const a of intl) {
            await ctx.db.patch(a._id, {
                status: "unverified",
                lastReviewedAt: undefined,
                hasConflict: undefined,
                conflictsWith: undefined,
                nextReviewAt: undefined,
            });
            resetCount++;
        }

        // Reset validation state
        const valState = await ctx.db.query("validationState")
            .withIndex("by_key", (q) => q.eq("key", "main"))
            .first();
        if (valState) {
            await ctx.db.patch(valState._id, {
                isRunning: false,
                currentLoop: 0,
                completionPercent: 0,
                currentInstruction: "",
                lastUpdatedAt: Date.now(),
            });
        }

        console.log(`✅ Reset ${resetCount} articles to unverified status`);
        return { success: true, resetCount };
    },
});

// =============================================================================
// ACTIONS (Triggers)
// =============================================================================

export const triggerResearchCycle = action({
    args: {},
    handler: async (ctx) => {
        console.log("Manually triggering research cycle...");
        await ctx.runAction(internal.research.runResearchCycle, {});
        return { success: true };
    },
});

// Curate Cambodia news - call this to fetch fresh Cambodian news
export const curateCambodiaNews = action({
    args: {},
    handler: async (ctx): Promise<{ success: boolean; error?: string }> => {
        console.log("🇰🇭 Curating Cambodia news...");
        try {
            await ctx.runAction(internal.research.curateCambodia, {});
            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    },
});

// Curate Thailand news - call this to fetch fresh Thai news
export const curateThailandNews = action({
    args: {},
    handler: async (ctx): Promise<{ success: boolean; error?: string }> => {
        console.log("🇹🇭 Curating Thailand news...");
        try {
            await ctx.runAction(internal.research.curateThailand, {});
            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    },
});

// Run full research cycle - curates news, synthesizes analysis, audits quality
export const runFullCycle = action({
    args: {},
    handler: async (ctx): Promise<{ success: boolean; error?: string }> => {
        console.log("🔄 Running full research cycle...");
        try {
            await ctx.runAction(internal.research.runResearchCycle, {});
            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    },
});

// Run database manager - verifies articles, updates credibility, flags bad articles
export const manageNews = action({
    args: {},
    handler: async (ctx): Promise<{ success: boolean; error?: string }> => {
        console.log("📋 Running database manager...");
        try {
            await ctx.runAction(internal.research.manageDatabase, {});
            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    },
});

// Curate international/3rd party news
export const curateInternationalNews = action({
    args: {},
    handler: async (ctx): Promise<{ success: boolean; error?: string }> => {
        console.log("🌍 Curating international news...");
        try {
            await ctx.runAction(internal.research.curateInternational, {});
            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    },
});

// =============================================================================
// VALIDATION QUERIES & MUTATIONS (used by validation.ts action)
// =============================================================================

export const getValidationState = internalQuery({
    args: {},
    handler: async (ctx) => {
        return await ctx.db
            .query("validationState")
            .withIndex("by_key", (q) => q.eq("key", "main"))
            .first();
    },
});

export const updateValidationState = internalMutation({
    args: {
        isRunning: v.optional(v.boolean()),
        activeRunId: v.optional(v.string()), // New field for lock
        currentLoop: v.optional(v.number()),
        lastManagerRun: v.optional(v.number()),
        completionPercent: v.optional(v.number()),
        currentInstruction: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("validationState")
            .withIndex("by_key", (q) => q.eq("key", "main"))
            .first();

        const updates = {
            ...(args.isRunning !== undefined && { isRunning: args.isRunning }),
            ...(args.activeRunId !== undefined && { activeRunId: args.activeRunId }),
            ...(args.currentLoop !== undefined && { currentLoop: args.currentLoop }),
            ...(args.lastManagerRun !== undefined && { lastManagerRun: args.lastManagerRun }),
            ...(args.completionPercent !== undefined && { completionPercent: args.completionPercent }),
            ...(args.currentInstruction !== undefined && { currentInstruction: args.currentInstruction }),
            lastUpdatedAt: Date.now(),
        };

        if (existing) {
            await ctx.db.patch(existing._id, updates);
        } else {
            await ctx.db.insert("validationState", {
                key: "main",
                isRunning: args.isRunning ?? false,
                activeRunId: args.activeRunId,
                currentLoop: args.currentLoop ?? 0,
                lastManagerRun: args.lastManagerRun ?? 0,
                completionPercent: args.completionPercent ?? 0,
                currentInstruction: args.currentInstruction ?? "",
                lastUpdatedAt: Date.now(),
            });
        }
    },
});

export const getValidationStats = internalQuery({
    args: {},
    handler: async (ctx) => {
        const thai = await ctx.db.query("thailandNews").collect();
        const cambo = await ctx.db.query("cambodiaNews").collect();
        const intl = await ctx.db.query("internationalNews").collect();

        const all = [
            ...thai.map(a => ({ ...a, country: "thailand" as const })),
            ...cambo.map(a => ({ ...a, country: "cambodia" as const })),
            ...intl.map(a => ({ ...a, country: "international" as const })),
        ];

        const today = Date.now() - 24 * 60 * 60 * 1000;

        return {
            totalArticles: all.length,
            unverifiedCount: all.filter(a => a.status === "unverified").length,
            activeCount: all.filter(a => a.status === "active").length,
            conflictCount: all.filter(a => a.hasConflict).length,
            reviewedTodayCount: all.filter(a => a.lastReviewedAt && a.lastReviewedAt > today).length,
        };
    },
});

export const getUnreviewedBatch = internalQuery({
    args: {
        batchSize: v.number(),
        priority: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const thai = await ctx.db.query("thailandNews").collect();
        const cambo = await ctx.db.query("cambodiaNews").collect();
        const intl = await ctx.db.query("internationalNews").collect();

        let all = [
            ...thai.map(a => ({ ...a, country: "thailand" as const })),
            ...cambo.map(a => ({ ...a, country: "cambodia" as const })),
            ...intl.map(a => ({ ...a, country: "international" as const })),
        ];

        // 1. Never reviewed
        // 2. Unverified status
        // 3. Has specific conflict flag
        // 4. "Active" but Checks due (Time > nextReviewAt)

        all = all.filter(a => {
            if (!a.lastReviewedAt) return true;
            if (a.status === "unverified") return true;
            if (a.hasConflict) return true;
            // If active, check if it's time for review
            if (a.status === "active" && a.nextReviewAt && Date.now() > a.nextReviewAt) return true;
            // Fallback for old records without nextReviewAt (default 12h)
            if (a.status === "active" && !a.nextReviewAt && (Date.now() - a.lastReviewedAt > 12 * 60 * 60 * 1000)) return true;
            return false;
        });

        // PRIORITIZATION:
        // 1. Conflicts (Immediate attention)
        // 2. Unverified (New info)
        // 3. Oldest Reviewed (Routine checkup)
        all.sort((a, b) => {
            // Conflicts first
            if (a.hasConflict && !b.hasConflict) return -1;
            if (!a.hasConflict && b.hasConflict) return 1;

            // Then Unverified
            if (a.status === "unverified" && b.status !== "unverified") return -1;
            if (a.status !== "unverified" && b.status === "unverified") return 1;

            // Then specific Priority arg
            if (args.priority?.includes("cambodia") && a.country === "cambodia" && b.country !== "cambodia") return -1;
            if (args.priority?.includes("thailand") && a.country === "thailand" && b.country !== "thailand") return -1;

            // Finally: Oldest review time first (Rotate through stale news)
            const timeA = a.lastReviewedAt || 0;
            const timeB = b.lastReviewedAt || 0;
            return timeA - timeB;
        });

        return all.slice(0, args.batchSize);
    },
});

export const getCrossRefArticles = internalQuery({
    args: {
        excludeCountry: v.optional(v.union(v.literal("thailand"), v.literal("cambodia"), v.literal("international"))),
        limit: v.number(),
    },
    handler: async (ctx, args) => {
        const articles: Array<{ title: string; source: string; credibility: number; country: "thailand" | "cambodia" | "international"; summary?: string }> = [];

        if (args.excludeCountry !== "thailand") {
            const thai = await ctx.db.query("thailandNews")
                .withIndex("by_status", q => q.eq("status", "active"))
                .take(args.limit);
            articles.push(...thai.map(a => ({
                title: a.title,
                source: a.source,
                credibility: a.credibility,
                country: "thailand" as const,
                summary: a.summary || a.summaryEn,
            })));
        }

        if (args.excludeCountry !== "cambodia") {
            const cambo = await ctx.db.query("cambodiaNews")
                .withIndex("by_status", q => q.eq("status", "active"))
                .take(args.limit);
            articles.push(...cambo.map(a => ({
                title: a.title,
                source: a.source,
                credibility: a.credibility,
                country: "cambodia" as const,
                summary: a.summary || a.summaryEn,
            })));
        }

        if (args.excludeCountry !== "international") {
            const intl = await ctx.db.query("internationalNews")
                .withIndex("by_status", q => q.eq("status", "active"))
                .take(args.limit);
            articles.push(...intl.map(a => ({
                title: a.title,
                source: a.source,
                credibility: a.credibility,
                country: "international" as const,
                summary: a.summary || a.summaryEn,
            })));
        }

        return articles.slice(0, args.limit);
    },
});

export const updateArticleValidation = internalMutation({
    args: {
        country: v.union(v.literal("thailand"), v.literal("cambodia"), v.literal("international")),
        title: v.string(),
        credibility: v.optional(v.number()),
        status: v.optional(v.union(
            v.literal("active"),
            v.literal("outdated"),
            v.literal("unverified"),
            v.literal("false"),
            v.literal("archived")
        )),
        hasConflict: v.optional(v.boolean()),
        conflictsWith: v.optional(v.string()),
        nextReviewAt: v.optional(v.number()),
        // Translation fixes
        titleTh: v.optional(v.string()),
        titleKh: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const table = args.country === "thailand" ? "thailandNews"
            : args.country === "cambodia" ? "cambodiaNews"
                : "internationalNews";

        const article = await ctx.db
            .query(table)
            .withIndex("by_title", (q) => q.eq("title", args.title))
            .first();

        if (article) {
            await ctx.db.patch(article._id, {
                ...(args.credibility !== undefined && { credibility: args.credibility }),
                ...(args.status !== undefined && { status: args.status }),
                ...(args.hasConflict !== undefined && { hasConflict: args.hasConflict }),
                ...(args.conflictsWith !== undefined && { conflictsWith: args.conflictsWith }),
                ...(args.titleTh !== undefined && { titleTh: args.titleTh }),
                ...(args.titleKh !== undefined && { titleKh: args.titleKh }),
                lastReviewedAt: Date.now(),
                nextReviewAt: args.nextReviewAt,
            });
            console.log(`✅ Updated: "${args.title}" (cred: ${args.credibility}, status: ${args.status})`);
        }
    },
});
