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
        const limit = Math.min(args.limit ?? 50, 100);
        const articles = await ctx.db
            .query(table)
            .order("desc")
            .take(limit);
        // Filter to only show active or unverified (not false, outdated, archived)
        return articles.filter(a => a.status === "active" || a.status === "unverified");
    },
});

// Slim query for list view - excludes heavy fields (summary, entities) to save ~70% bandwidth
export const getNewsSlim = query({
    args: {
        country: v.union(v.literal("thailand"), v.literal("cambodia")),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const table = args.country === "thailand" ? "thailandNews" : "cambodiaNews";
        const limit = Math.min(args.limit ?? 20, 100);
        const articles = await ctx.db
            .query(table)
            .order("desc")
            .take(limit);

        // Map to slim object
        return articles
            .filter(a => a.status === "active" || a.status === "unverified")
            .map(a => ({
                _id: a._id,
                title: a.title,
                titleEn: a.titleEn,
                titleTh: a.titleTh,
                titleKh: a.titleKh,
                publishedAt: a.publishedAt,
                fetchedAt: a.fetchedAt,
                source: a.source,
                sourceUrl: a.sourceUrl,
                category: a.category,
                credibility: a.credibility,
                status: a.status,
                // Exclude: summary, summaryEn/Th/Kh, keyPoints, entities
            }));
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
        const stats = await ctx.db.query("systemStats")
            .withIndex("by_key", (q) => q.eq("key", "main"))
            .first();

        // Bandwidth Optimization: Only return fields that trigger UI updates (status/timer)
        // We EXCLUDE "totalArticlesFetched" because it changes constantly and triggers
        // a websocket push to ALL clients for every single article found.
        return stats ? {
            lastResearchAt: stats.lastResearchAt,
            systemStatus: stats.systemStatus,
            isPaused: stats.isPaused,
        } : null;
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
        // Optimized counting using indexes - NO document fetching

        // Helper to count active + unverified
        const countTable = async (tableName: "thailandNews" | "cambodiaNews" | "internationalNews") => {
            const activeDocs = await ctx.db.query(tableName).withIndex("by_status", q => q.eq("status", "active")).collect();
            const unverifiedDocs = await ctx.db.query(tableName).withIndex("by_status", q => q.eq("status", "unverified")).collect();
            return activeDocs.length + unverifiedDocs.length;
        };

        const thailand = await countTable("thailandNews");
        const cambodia = await countTable("cambodiaNews");
        const international = await countTable("internationalNews");

        return {
            thailand,
            cambodia,
            international,
            total: thailand + cambodia + international,
        };
    },
});

// Timeline events for frontend display
export const getTimeline = query({
    args: {
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const limit = Math.min(args.limit ?? 200, 500);
        const events = await ctx.db
            .query("timelineEvents")
            .withIndex("by_date")
            .order("desc")
            .take(limit);
        return events;
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

        // Only get articles from last 2 days to keep prompt size small
        const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
        const cutoff = Date.now() - TWO_DAYS_MS;

        const articles = await ctx.db.query(table).collect();
        return articles
            .filter(a => (a.publishedAt || a.fetchedAt) > cutoff)
            .map(a => ({ title: a.title, source: a.source, sourceUrl: a.sourceUrl }));
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
// SOURCE VERIFICATION LOCK (articlecred step - prevents zombies)
// =============================================================================

export const getSourceVerificationState = internalQuery({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("sourceVerificationState")
            .withIndex("by_key", (q) => q.eq("key", "main"))
            .first();
    },
});

export const acquireSourceVerificationLock = internalMutation({
    args: {
        runId: v.string(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db.query("sourceVerificationState")
            .withIndex("by_key", (q) => q.eq("key", "main"))
            .first();

        const now = Date.now();
        const ZOMBIE_TIMEOUT = 5 * 60 * 1000; // 5 minutes = zombie

        if (existing) {
            // Check if there's an active run
            if (existing.isRunning) {
                // Check if it's a zombie (no heartbeat in 5 minutes)
                const lastActivity = existing.lastHeartbeat || existing.startedAt || 0;
                if (now - lastActivity > ZOMBIE_TIMEOUT) {
                    console.log(`🧟 [VERIFY] Found zombie run from ${new Date(existing.startedAt || 0).toISOString()}, taking over...`);
                    // Take over the zombie
                    await ctx.db.patch(existing._id, {
                        isRunning: true,
                        runId: args.runId,
                        startedAt: now,
                        lastHeartbeat: now,
                        progress: "starting...",
                    });
                    return { acquired: true, tookOverZombie: true };
                } else {
                    // Active run exists, can't acquire
                    console.log(`⚠️ [VERIFY] Another run is active (started ${Math.floor((now - (existing.startedAt || 0)) / 1000)}s ago)`);
                    return { acquired: false, activeRunId: existing.runId };
                }
            }
            // No active run, acquire lock
            await ctx.db.patch(existing._id, {
                isRunning: true,
                runId: args.runId,
                startedAt: now,
                lastHeartbeat: now,
                progress: "starting...",
            });
        } else {
            // First time, create the record
            await ctx.db.insert("sourceVerificationState", {
                key: "main",
                isRunning: true,
                runId: args.runId,
                startedAt: now,
                lastHeartbeat: now,
                progress: "starting...",
            });
        }
        return { acquired: true, tookOverZombie: false };
    },
});

export const updateSourceVerificationProgress = internalMutation({
    args: {
        runId: v.string(),
        progress: v.string(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db.query("sourceVerificationState")
            .withIndex("by_key", (q) => q.eq("key", "main"))
            .first();

        if (existing && existing.runId === args.runId) {
            await ctx.db.patch(existing._id, {
                lastHeartbeat: Date.now(),
                progress: args.progress,
            });
        }
    },
});

export const releaseSourceVerificationLock = internalMutation({
    args: {
        runId: v.string(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db.query("sourceVerificationState")
            .withIndex("by_key", (q) => q.eq("key", "main"))
            .first();

        if (existing && existing.runId === args.runId) {
            await ctx.db.patch(existing._id, {
                isRunning: false,
                runId: undefined,
                startedAt: undefined,
                lastHeartbeat: undefined,
                progress: undefined,
            });
            console.log(`🔓 [VERIFY] Lock released`);
        }
    },
});

/**
 * Force release the source verification lock
 * Use this when a run times out and leaves a zombie lock
 */
export const forceReleaseSourceVerificationLock = internalMutation({
    args: {},
    handler: async (ctx) => {
        const existing = await ctx.db.query("sourceVerificationState")
            .withIndex("by_key", (q) => q.eq("key", "main"))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, {
                isRunning: false,
                runId: undefined,
                startedAt: undefined,
                lastHeartbeat: undefined,
                progress: undefined,
            });
            console.log(`🔓 [VERIFY] Lock FORCE released (was held by ${existing.runId})`);
            return { released: true, wasHeldBy: existing.runId };
        }
        return { released: false, message: "No lock found" };
    },
});

/**
 * Reset source verification status for all articles
 * This clears sourceVerifiedAt so they will be re-verified
 */
export const resetSourceVerification = internalMutation({
    args: {},
    handler: async (ctx) => {
        let cleared = 0;

        // Clear from all three tables
        const tables = ["thailandNews", "cambodiaNews", "internationalNews"] as const;

        for (const table of tables) {
            const articles = await ctx.db.query(table).collect();
            for (const article of articles) {
                if (article.sourceVerifiedAt) {
                    await ctx.db.patch(article._id, { sourceVerifiedAt: undefined });
                    cleared++;
                }
            }
        }

        console.log(`🔄 [VERIFY] Reset verification status for ${cleared} articles`);
        return { cleared };
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

/**
 * Mark an article as source-verified (URL is real, content matches)
 * Used by verifyAllSources when article passes verification
 */
export const markSourceVerified = internalMutation({
    args: {
        country: v.union(v.literal("thailand"), v.literal("cambodia"), v.literal("international")),
        title: v.string(),
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
                sourceVerifiedAt: Date.now(),
                status: "active", // Mark as active once verified
            });
        }
    },
});

/**
 * Update article content (title, summary, date, translations) - used by source verification
 * When we find the URL is valid but our stored data is wrong
 */
export const updateArticleContent = internalMutation({
    args: {
        country: v.union(v.literal("thailand"), v.literal("cambodia"), v.literal("international")),
        oldTitle: v.string(),  // Find by old title
        // New content - all optional
        newTitle: v.optional(v.string()),
        newTitleEn: v.optional(v.string()),
        newTitleTh: v.optional(v.string()),
        newTitleKh: v.optional(v.string()),
        newSummary: v.optional(v.string()),
        newSummaryEn: v.optional(v.string()),
        newSummaryTh: v.optional(v.string()),
        newSummaryKh: v.optional(v.string()),
        publishedAt: v.optional(v.number()),
        credibility: v.optional(v.number()),
        status: v.optional(v.union(
            v.literal("active"),
            v.literal("unverified"),
        )),
    },
    handler: async (ctx, args) => {
        const table = args.country === "thailand" ? "thailandNews"
            : args.country === "cambodia" ? "cambodiaNews"
                : "internationalNews";

        const article = await ctx.db
            .query(table)
            .withIndex("by_title", (q) => q.eq("title", args.oldTitle))
            .first();

        if (article) {
            await ctx.db.patch(article._id, {
                // Title fields
                ...(args.newTitle !== undefined && { title: args.newTitle }),
                ...(args.newTitleEn !== undefined && { titleEn: args.newTitleEn }),
                ...(args.newTitleTh !== undefined && { titleTh: args.newTitleTh }),
                ...(args.newTitleKh !== undefined && { titleKh: args.newTitleKh }),
                // Summary fields
                ...(args.newSummary !== undefined && { summary: args.newSummary }),
                ...(args.newSummaryEn !== undefined && { summaryEn: args.newSummaryEn }),
                ...(args.newSummaryTh !== undefined && { summaryTh: args.newSummaryTh }),
                ...(args.newSummaryKh !== undefined && { summaryKh: args.newSummaryKh }),
                // Other fields
                ...(args.publishedAt !== undefined && { publishedAt: args.publishedAt }),
                ...(args.credibility !== undefined && { credibility: args.credibility }),
                ...(args.status !== undefined && { status: args.status }),
                lastReviewedAt: Date.now(),
                sourceVerifiedAt: Date.now(), // Mark as source-verified
            });
            console.log(`📝 Updated content for "${args.oldTitle}" → "${args.newTitle || args.oldTitle}"`);
        } else {
            console.log(`⚠️ Could not find article to update: "${args.oldTitle}"`);
        }
    },
});

// Update article URL when verifier finds the correct one
export const updateArticleUrl = internalMutation({
    args: {
        country: v.union(v.literal("thailand"), v.literal("cambodia"), v.literal("international")),
        oldTitle: v.string(),
        newUrl: v.string(),
    },
    handler: async (ctx, args) => {
        const table = args.country === "thailand" ? "thailandNews"
            : args.country === "cambodia" ? "cambodiaNews"
                : "internationalNews";

        const article = await ctx.db
            .query(table)
            .withIndex("by_title", (q) => q.eq("title", args.oldTitle))
            .first();

        if (article) {
            await ctx.db.patch(article._id, {
                sourceUrl: args.newUrl,
                sourceVerifiedAt: Date.now(),
            });
            console.log(`🔗 Updated URL for "${args.oldTitle}": ${article.sourceUrl} → ${args.newUrl}`);
        } else {
            console.log(`⚠️ Could not find article to update URL: "${args.oldTitle}"`);
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

// Internal mutation to clear skipNextCycle flag (called automatically after skip)
export const clearSkipNextCycle = internalMutation({
    args: {},
    handler: async (ctx) => {
        const existing = await ctx.db.query("systemStats")
            .withIndex("by_key", (q) => q.eq("key", "main"))
            .first();
        if (existing) {
            await ctx.db.patch(existing._id, { skipNextCycle: false });
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

export const resumeResearchCycle = mutation({
    args: {},
    handler: async (ctx) => {
        console.log("▶️ RESUME: Resuming research cycle...");
        const existing = await ctx.db.query("systemStats")
            .withIndex("by_key", (q) => q.eq("key", "main"))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, {
                isPaused: false,
                systemStatus: "online",
                errorLog: undefined  // Clear error log
            });
            console.log("✅ Research cycle resumed - status set to online");
        }
    },
});

// Skip ONLY the next research cycle (auto-resets after skip)
export const skipNextCycle = mutation({
    args: {},
    handler: async (ctx) => {
        console.log("⏭️ SKIP NEXT: Will skip the next research cycle only");
        const existing = await ctx.db.query("systemStats")
            .withIndex("by_key", (q) => q.eq("key", "main"))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, { skipNextCycle: true });
            console.log("✅ Next research cycle will be skipped");
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

// Run Historian cycle - processes unverified articles into timeline events
export const runHistorian = action({
    args: {},
    handler: async (ctx): Promise<{ success: boolean; result?: any; error?: string }> => {
        console.log("📜 Running Historian cycle...");
        try {
            const result = await ctx.runAction(internal.historian.runHistorianCycle, {});
            return { success: true, result };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    },
});

// Reset processedToTimeline flag on all articles so Historian can reprocess them
export const resetHistorianFlags = action({
    args: {},
    handler: async (ctx): Promise<{ success: boolean; resetCount: number }> => {
        console.log("🔄 Resetting Historian flags on all articles...");
        const result = await ctx.runMutation(internal.api.clearProcessedToTimeline, {});
        return { success: true, resetCount: result };
    },
});

// Clear all timeOfDay values (reset to undefined)
export const clearTimeOfDay = action({
    args: {},
    handler: async (ctx): Promise<{ success: boolean; cleared: number }> => {
        console.log("🗑️ Clearing all timeOfDay values...");
        const result = await ctx.runMutation(internal.api.resetTimeOfDayForEvents, {});
        return { success: true, cleared: result };
    },
});

// Export all timeline events for manual review
export const exportTimelineEvents = action({
    args: {},
    handler: async (ctx): Promise<string> => {
        const events = await ctx.runQuery(internal.api.getAllTimelineEvents, {});
        // Format for easy pasting into ChatGPT
        let output = `TIMELINE EVENTS (${events.length} total)\n`;
        output += `Please estimate a time of day (HH:MM format, like "08:00", "14:30", "22:00") for each event based on when it most likely happened.\n\n`;

        for (const e of events) {
            output += `---\n`;
            output += `ID: ${e._id}\n`;
            output += `Date: ${e.date}\n`;
            output += `Title: ${e.title}\n`;
            output += `Description: ${e.description}\n`;
            output += `Category: ${e.category}\n`;
            output += `Current timeOfDay: ${e.timeOfDay || "(none)"}\n`;
            output += `\n`;
        }

        console.log(output);
        return output;
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

/**
 * Get articles that haven't been processed by the Historian yet
 * This returns articles regardless of validation status (active, unverified, etc.)
 * Only excludes: archived, false, and already processed articles
 */
export const getUnprocessedForTimeline = internalQuery({
    args: {
        batchSize: v.number(),
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

        // Filter: NOT processed to timeline AND NOT archived/false
        all = all.filter(a =>
            !a.processedToTimeline &&
            a.status !== "archived" &&
            a.status !== "false"
        );

        // Sort by credibility (higher first) to process best sources first
        all.sort((a, b) => (b.credibility || 50) - (a.credibility || 50));

        return all.slice(0, args.batchSize);
    },
});

/**
 * Mark an article as processed by the Historian
 * Called after Historian makes a decision about the article
 */
export const markAsProcessedToTimeline = internalMutation({
    args: {
        country: v.union(v.literal("thailand"), v.literal("cambodia"), v.literal("international")),
        title: v.string(),
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
            await ctx.db.patch(article._id, { processedToTimeline: true });
        }
    },
});

/**
 * Clear processedToTimeline flag on ALL articles
 * Used when you want to re-run Historian on existing articles
 */
export const clearProcessedToTimeline = internalMutation({
    args: {},
    handler: async (ctx) => {
        let resetCount = 0;

        // Reset Thailand articles
        const thai = await ctx.db.query("thailandNews").collect();
        for (const a of thai) {
            if (a.processedToTimeline) {
                await ctx.db.patch(a._id, { processedToTimeline: false });
                resetCount++;
            }
        }

        // Reset Cambodia articles
        const cambo = await ctx.db.query("cambodiaNews").collect();
        for (const a of cambo) {
            if (a.processedToTimeline) {
                await ctx.db.patch(a._id, { processedToTimeline: false });
                resetCount++;
            }
        }

        // Reset International articles
        const intl = await ctx.db.query("internationalNews").collect();
        for (const a of intl) {
            if (a.processedToTimeline) {
                await ctx.db.patch(a._id, { processedToTimeline: false });
                resetCount++;
            }
        }

        console.log(`🔄 Reset processedToTimeline on ${resetCount} articles`);
        return resetCount;
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

// =============================================================================
// TIMELINE EVENT MUTATIONS & QUERIES
// The "memory" layer - stores key historical events for AI synthesis
// =============================================================================

/**
 * Create a new timeline event
 * Checks for duplicates by date + title similarity
 */
export const createTimelineEvent = internalMutation({
    args: {
        date: v.string(),           // ISO date "2024-12-12"
        timeOfDay: v.optional(v.string()),  // Estimated time "08:00", "14:30", "22:00"
        title: v.string(),          // English title
        titleTh: v.optional(v.string()),  // Thai translation
        titleKh: v.optional(v.string()),  // Khmer translation
        description: v.string(),    // English description
        descriptionTh: v.optional(v.string()),  // Thai translation
        descriptionKh: v.optional(v.string()),  // Khmer translation
        category: v.union(
            v.literal("military"),
            v.literal("diplomatic"),
            v.literal("humanitarian"),
            v.literal("political")
        ),
        importance: v.number(),     // 0-100, AI-determined
        sources: v.array(v.object({
            url: v.string(),
            name: v.string(),
            country: v.string(),
            credibility: v.number(),
            snippet: v.optional(v.string()),
        })),
    },
    handler: async (ctx, args) => {
        // Check for duplicate by date + exact title
        const existing = await ctx.db
            .query("timelineEvents")
            .withIndex("by_date", q => q.eq("date", args.date))
            .filter(q => q.eq(q.field("title"), args.title))
            .first();

        if (existing) {
            console.log(`⚠️ Timeline event already exists: "${args.title}" on ${args.date}`);
            return null;
        }

        const now = Date.now();
        const eventId = await ctx.db.insert("timelineEvents", {
            date: args.date,
            timeOfDay: args.timeOfDay,  // Estimated time for chronological ordering
            title: args.title,
            titleTh: args.titleTh,
            titleKh: args.titleKh,
            description: args.description,
            descriptionTh: args.descriptionTh,
            descriptionKh: args.descriptionKh,
            category: args.category,
            importance: Math.max(0, Math.min(100, args.importance)),
            status: "confirmed",
            sources: args.sources.map(s => ({ ...s, addedAt: now })),
            createdAt: now,
            lastUpdatedAt: now,
        });

        console.log(`📌 Created timeline event: "${args.title}" (importance: ${args.importance})`);
        return eventId;
    },
});

/**
 * Add a new source to an existing timeline event
 * Used when multiple articles report the same event
 */
export const addSourceToEvent = internalMutation({
    args: {
        eventId: v.id("timelineEvents"),
        source: v.object({
            url: v.string(),
            name: v.string(),
            country: v.string(),
            credibility: v.number(),
            snippet: v.optional(v.string()),
        }),
    },
    handler: async (ctx, args) => {
        const event = await ctx.db.get(args.eventId);
        if (!event) {
            console.log(`⚠️ Timeline event not found: ${args.eventId}`);
            return null;
        }

        // Avoid duplicate URLs
        if (event.sources.some(s => s.url === args.source.url)) {
            console.log(`⚠️ Source already linked: ${args.source.url}`);
            return null;
        }

        await ctx.db.patch(args.eventId, {
            sources: [...event.sources, { ...args.source, addedAt: Date.now() }],
            lastUpdatedAt: Date.now(),
        });

        console.log(`➕ Added source "${args.source.name}" to event: "${event.title}"`);
        return args.eventId;
    },
});

/**
 * Update event verification status
 * Used when conflicting information is found
 */
export const updateEventStatus = internalMutation({
    args: {
        eventId: v.id("timelineEvents"),
        status: v.union(
            v.literal("confirmed"),
            v.literal("disputed"),
            v.literal("debunked")
        ),
        reason: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const event = await ctx.db.get(args.eventId);
        if (!event) return null;

        await ctx.db.patch(args.eventId, {
            status: args.status,
            lastUpdatedAt: Date.now(),
        });

        console.log(`🏷️ Updated event status: "${event.title}" → ${args.status}${args.reason ? ` (${args.reason})` : ""}`);
        return args.eventId;
    },
});

/**
 * Update timeline event content
 * Used by Historian to edit existing events when new info is found
 */
export const updateTimelineEvent = internalMutation({
    args: {
        eventTitle: v.string(), // Find by title (Historian references events by title)
        updates: v.object({
            title: v.optional(v.string()),
            titleTh: v.optional(v.string()),
            titleKh: v.optional(v.string()),
            description: v.optional(v.string()),
            descriptionTh: v.optional(v.string()),
            descriptionKh: v.optional(v.string()),
            date: v.optional(v.string()),
            timeOfDay: v.optional(v.string()),  // Estimated time "08:00", "14:30"
            category: v.optional(v.union(
                v.literal("military"),
                v.literal("diplomatic"),
                v.literal("humanitarian"),
                v.literal("political")
            )),
            importance: v.optional(v.number()),
            status: v.optional(v.union(
                v.literal("confirmed"),
                v.literal("disputed"),
                v.literal("debunked")
            )),
        }),
        reason: v.string(), // Required - audit trail
    },
    handler: async (ctx, args) => {
        // Try exact match first
        let event = await ctx.db
            .query("timelineEvents")
            .filter(q => q.eq(q.field("title"), args.eventTitle))
            .first();

        // If no exact match, try fuzzy matching
        if (!event) {
            const allEvents = await ctx.db.query("timelineEvents").collect();
            const searchLower = args.eventTitle.toLowerCase().trim();

            // Try to find a close match
            event = allEvents.find(e => {
                const titleLower = e.title.toLowerCase().trim();
                // Exact lowercase match
                if (titleLower === searchLower) return true;
                // One contains the other (for partial matches)
                if (titleLower.includes(searchLower) || searchLower.includes(titleLower)) return true;
                // First 40 chars match (for truncated titles)
                if (titleLower.substring(0, 40) === searchLower.substring(0, 40)) return true;
                return false;
            }) || null;

            if (event) {
                console.log(`🔍 Fuzzy matched "${args.eventTitle}" → "${event.title}"`);
            }
        }

        if (!event) {
            console.log(`⚠️ Event not found for update: "${args.eventTitle}"`);
            return null;
        }

        // Build patch object with only provided fields
        const patch: any = { lastUpdatedAt: Date.now() };
        if (args.updates.title !== undefined) patch.title = args.updates.title;
        if (args.updates.titleTh !== undefined) patch.titleTh = args.updates.titleTh;
        if (args.updates.titleKh !== undefined) patch.titleKh = args.updates.titleKh;
        if (args.updates.description !== undefined) patch.description = args.updates.description;
        if (args.updates.descriptionTh !== undefined) patch.descriptionTh = args.updates.descriptionTh;
        if (args.updates.descriptionKh !== undefined) patch.descriptionKh = args.updates.descriptionKh;
        if (args.updates.date !== undefined) patch.date = args.updates.date;
        if (args.updates.timeOfDay !== undefined) patch.timeOfDay = args.updates.timeOfDay;
        if (args.updates.category !== undefined) patch.category = args.updates.category;
        if (args.updates.importance !== undefined) patch.importance = Math.max(0, Math.min(100, args.updates.importance));
        if (args.updates.status !== undefined) patch.status = args.updates.status;

        await ctx.db.patch(event._id, patch);

        const changedFields = Object.keys(args.updates).filter(k => (args.updates as any)[k] !== undefined);
        console.log(`✏️ Updated event "${args.eventTitle}": [${changedFields.join(", ")}] - ${args.reason}`);
        return event._id;
    },
});

/**
 * Delete a timeline event - USE WITH EXTREME CAUTION
 * Only for completely fabricated/fake events that should never have existed
 * For debunked events, prefer setting status to "debunked" instead
 */
export const deleteTimelineEvent = internalMutation({
    args: {
        eventTitle: v.string(),
        reason: v.string(), // Required - must justify deletion
    },
    handler: async (ctx, args) => {
        // Try exact match first
        let event = await ctx.db
            .query("timelineEvents")
            .filter(q => q.eq(q.field("title"), args.eventTitle))
            .first();

        // If no exact match, try fuzzy matching
        if (!event) {
            const allEvents = await ctx.db.query("timelineEvents").collect();
            const searchLower = args.eventTitle.toLowerCase().trim();

            // Try to find a close match
            event = allEvents.find(e => {
                const titleLower = e.title.toLowerCase().trim();
                // Exact lowercase match
                if (titleLower === searchLower) return true;
                // One contains the other (for partial matches)
                if (titleLower.includes(searchLower) || searchLower.includes(titleLower)) return true;
                // First 40 chars match (for truncated titles)
                if (titleLower.substring(0, 40) === searchLower.substring(0, 40)) return true;
                return false;
            }) || null;

            if (event) {
                console.log(`🔍 Fuzzy matched for delete "${args.eventTitle}" → "${event.title}"`);
            }
        }

        if (!event) {
            console.log(`⚠️ Event not found for deletion: "${args.eventTitle}"`);
            return null;
        }

        await ctx.db.delete(event._id);
        console.log(`🗑️ DELETED timeline event: "${args.eventTitle}" - Reason: ${args.reason}`);
        return event._id;
    },
});

/**
 * Reset timeOfDay for all events (clear the bad values)
 */
export const resetTimeOfDayForEvents = internalMutation({
    args: {},
    handler: async (ctx) => {
        const events = await ctx.db.query("timelineEvents").collect();
        let cleared = 0;

        for (const event of events) {
            if (event.timeOfDay) {
                await ctx.db.patch(event._id, {
                    timeOfDay: undefined,
                    lastUpdatedAt: Date.now()
                });
                console.log(`🗑️ Cleared timeOfDay for "${event.title}"`);
                cleared++;
            }
        }

        console.log(`✅ Cleared timeOfDay from ${cleared} events`);
        return cleared;
    },
});

/**
 * Get all timeline events for export
 */
export const getAllTimelineEvents = internalQuery({
    args: {},
    handler: async (ctx) => {
        const events = await ctx.db.query("timelineEvents").collect();
        // Sort by date for easy reading
        events.sort((a, b) => a.date.localeCompare(b.date));
        return events;
    },
});

/**
 * Get recent timeline events for synthesis context
 * Returns events sorted CHRONOLOGICALLY by date + timeOfDay (oldest first)
 * This ensures AI receives events in proper historical order
 */
export const getRecentTimeline = internalQuery({
    args: {
        limit: v.number(),
        minImportance: v.optional(v.number()),  // Filter by minimum importance
        category: v.optional(v.string()),       // Filter by category
    },
    handler: async (ctx, args) => {
        // Get all events
        const events = await ctx.db.query("timelineEvents").collect();

        // Apply filters
        let filtered = events.filter(e => e.status !== "debunked"); // Exclude debunked

        if (args.minImportance !== undefined) {
            filtered = filtered.filter(e => e.importance >= args.minImportance!);
        }

        if (args.category) {
            filtered = filtered.filter(e => e.category === args.category);
        }

        // Sort CHRONOLOGICALLY: oldest first, by date + timeOfDay
        // This gives AI proper historical context (events in order they happened)
        filtered.sort((a, b) => {
            // First compare by date
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;

            // Same date: compare by timeOfDay (events without time sort to end of day)
            const timeA = a.timeOfDay || "99:99";  // Unknown times go last within day
            const timeB = b.timeOfDay || "99:99";
            return timeA.localeCompare(timeB);
        });

        return filtered.slice(0, args.limit);
    },
});

/**
 * Find an event by approximate title match and date range
 * Used for merging sources into existing events
 */
export const findEventByTitleAndDate = internalQuery({
    args: {
        title: v.string(),          // Title to search for
        dateRange: v.optional(v.object({
            start: v.string(),      // ISO date "2024-12-01"
            end: v.string(),        // ISO date "2024-12-15"
        })),
    },
    handler: async (ctx, args) => {
        const events = await ctx.db
            .query("timelineEvents")
            .withIndex("by_createdAt")
            .order("desc")
            .take(100);  // Search recent events

        // Simple case-insensitive title search
        const searchLower = args.title.toLowerCase();
        const matches = events.filter(e => {
            const titleMatch = e.title.toLowerCase().includes(searchLower) ||
                searchLower.includes(e.title.toLowerCase());

            // Optional date range filter
            if (args.dateRange) {
                const eventDate = e.date;
                if (eventDate < args.dateRange.start || eventDate > args.dateRange.end) {
                    return false;
                }
            }

            return titleMatch;
        });

        return matches;
    },
});

/**
 * Get timeline events that may need conflict checking
 * (disputed status or recently updated)
 */
export const getEventsForConflictCheck = internalQuery({
    args: {
        limit: v.number(),
    },
    handler: async (ctx, args) => {
        // Get disputed events
        const disputed = await ctx.db
            .query("timelineEvents")
            .withIndex("by_status", q => q.eq("status", "disputed"))
            .take(args.limit);

        return disputed;
    },
});

/**
 * Get timeline statistics for the Manager to make decisions
 */
export const getTimelineStats = internalQuery({
    args: {},
    handler: async (ctx) => {
        const all = await ctx.db.query("timelineEvents").collect();

        return {
            totalEvents: all.length,
            confirmedCount: all.filter(e => e.status === "confirmed").length,
            disputedCount: all.filter(e => e.status === "disputed").length,
            debunkedCount: all.filter(e => e.status === "debunked").length,
            avgImportance: all.length > 0
                ? Math.round(all.reduce((sum, e) => sum + e.importance, 0) / all.length)
                : 0,
            byCategory: {
                military: all.filter(e => e.category === "military").length,
                diplomatic: all.filter(e => e.category === "diplomatic").length,
                humanitarian: all.filter(e => e.category === "humanitarian").length,
                political: all.filter(e => e.category === "political").length,
            },
        };
    },
});

