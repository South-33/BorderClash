import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    // ==================== NEWS TABLES ====================
    // Managed by Ghost API (Scout + Validation)

    thailandNews: defineTable({
        title: v.string(),              // Primary title (English)
        titleEn: v.optional(v.string()), // English title
        titleTh: v.optional(v.string()), // Thai title
        titleKh: v.optional(v.string()), // Khmer title
        publishedAt: v.number(),
        sourceUrl: v.string(),
        source: v.string(),
        category: v.union(v.literal("military"), v.literal("political"), v.literal("humanitarian"), v.literal("diplomatic")),
        status: v.union(
            v.literal("active"),      // Current, verified news
            v.literal("outdated"),    // Old but was true
            v.literal("unverified"),  // Not yet verified
            v.literal("false"),       // Proven false/misleading (kept for record)
            v.literal("archived")     // Old, moved out of active view
        ),
        credibility: v.number(),      // 0-100 confidence score
        summary: v.optional(v.string()),
        summaryEn: v.optional(v.string()),
        summaryTh: v.optional(v.string()),
        summaryKh: v.optional(v.string()),
        fetchedAt: v.number(),
        // Validation fields
        lastReviewedAt: v.optional(v.number()),
        hasConflict: v.optional(v.boolean()),
        conflictsWith: v.optional(v.string()),
        nextReviewAt: v.optional(v.number()), // AI-determined re-check time
        // Timeline processing
        processedToTimeline: v.optional(v.boolean()), // True = Historian has processed this
        // Source verification (articlecred step)
        sourceVerifiedAt: v.optional(v.number()), // When AI verified this URL/content is real
    })
        .index("by_status", ["status"])
        .index("by_title", ["title"])
        .index("by_unreviewed", ["status", "lastReviewedAt"])
        .index("by_url", ["sourceUrl"])
        // Phase 2 bandwidth optimization: compound indexes for synthesis queries
        .index("by_status_credibility", ["status", "credibility"])
        .index("by_status_publishedAt", ["status", "publishedAt"])
        // Phase 3 bandwidth optimization: index for unprocessed article queries
        .index("by_status_processed", ["status", "processedToTimeline"]),

    cambodiaNews: defineTable({
        title: v.string(),
        titleEn: v.optional(v.string()),
        titleTh: v.optional(v.string()),
        titleKh: v.optional(v.string()),
        publishedAt: v.number(),
        sourceUrl: v.string(),
        source: v.string(),
        category: v.union(v.literal("military"), v.literal("political"), v.literal("humanitarian"), v.literal("diplomatic")),
        status: v.union(
            v.literal("active"),
            v.literal("outdated"),
            v.literal("unverified"),
            v.literal("false"),
            v.literal("archived")
        ),
        credibility: v.number(),
        summary: v.optional(v.string()),
        summaryEn: v.optional(v.string()),
        summaryTh: v.optional(v.string()),
        summaryKh: v.optional(v.string()),
        fetchedAt: v.number(),
        lastReviewedAt: v.optional(v.number()),
        hasConflict: v.optional(v.boolean()),
        conflictsWith: v.optional(v.string()),
        nextReviewAt: v.optional(v.number()),
        // Timeline processing
        processedToTimeline: v.optional(v.boolean()),
        // Source verification (articlecred step)
        sourceVerifiedAt: v.optional(v.number()),
    })
        .index("by_status", ["status"])
        .index("by_title", ["title"])
        .index("by_unreviewed", ["status", "lastReviewedAt"])
        .index("by_url", ["sourceUrl"])
        // Phase 2 bandwidth optimization: compound indexes for synthesis queries
        .index("by_status_credibility", ["status", "credibility"])
        .index("by_status_publishedAt", ["status", "publishedAt"])
        // Phase 3 bandwidth optimization: index for unprocessed article queries
        .index("by_status_processed", ["status", "processedToTimeline"]),

    // International/3rd party news (Reuters, AFP, BBC, Al Jazeera, etc.)
    internationalNews: defineTable({
        title: v.string(),
        titleEn: v.optional(v.string()),
        titleTh: v.optional(v.string()),
        titleKh: v.optional(v.string()),
        publishedAt: v.number(),
        sourceUrl: v.string(),
        source: v.string(),
        category: v.union(v.literal("military"), v.literal("political"), v.literal("humanitarian"), v.literal("diplomatic")),
        status: v.union(
            v.literal("active"),
            v.literal("outdated"),
            v.literal("unverified"),
            v.literal("false"),
            v.literal("archived")
        ),
        credibility: v.number(),
        summary: v.optional(v.string()),
        summaryEn: v.optional(v.string()),
        summaryTh: v.optional(v.string()),
        summaryKh: v.optional(v.string()),
        fetchedAt: v.number(),
        lastReviewedAt: v.optional(v.number()),
        hasConflict: v.optional(v.boolean()),
        conflictsWith: v.optional(v.string()),
        nextReviewAt: v.optional(v.number()),
        // Timeline processing
        processedToTimeline: v.optional(v.boolean()),
        // Source verification (articlecred step)
        sourceVerifiedAt: v.optional(v.number()),
    })
        .index("by_status", ["status"])
        .index("by_title", ["title"])
        .index("by_unreviewed", ["status", "lastReviewedAt"])
        .index("by_url", ["sourceUrl"])
        // Phase 2 bandwidth optimization: compound indexes for synthesis queries
        .index("by_status_credibility", ["status", "credibility"])
        .index("by_status_publishedAt", ["status", "publishedAt"])
        // Phase 3 bandwidth optimization: index for unprocessed article queries
        .index("by_status_processed", ["status", "processedToTimeline"]),

    // ==================== ANALYSIS TABLES ====================
    // Managed by Flash (Synthesizer) - Frontend display tables

    thailandAnalysis: defineTable({
        officialNarrative: v.string(),
        officialNarrativeEn: v.optional(v.string()),
        officialNarrativeTh: v.optional(v.string()),
        officialNarrativeKh: v.optional(v.string()),
        narrativeSource: v.string(),
        militaryIntensity: v.number(),
        militaryPosture: v.union(v.literal("PEACEFUL"), v.literal("DEFENSIVE"), v.literal("AGGRESSIVE")),
        // Detailed posture context with translations
        postureLabel: v.optional(v.string()),           // Short label (English default)
        postureLabelEn: v.optional(v.string()),
        postureLabelTh: v.optional(v.string()),
        postureLabelKh: v.optional(v.string()),
        postureRationale: v.optional(v.string()),       // AI explanation (English default)
        postureRationaleEn: v.optional(v.string()),
        postureRationaleTh: v.optional(v.string()),
        postureRationaleKh: v.optional(v.string()),
        territorialContext: v.optional(v.union(
            v.literal("OWN_TERRITORY"),
            v.literal("DISPUTED_ZONE"),
            v.literal("FOREIGN_TERRITORY"),
            v.literal("BORDER_ZONE")
        )),
        lastUpdatedAt: v.number(),
    }),

    cambodiaAnalysis: defineTable({
        officialNarrative: v.string(),
        officialNarrativeEn: v.optional(v.string()),
        officialNarrativeTh: v.optional(v.string()),
        officialNarrativeKh: v.optional(v.string()),
        narrativeSource: v.string(),
        militaryIntensity: v.number(),
        militaryPosture: v.union(v.literal("PEACEFUL"), v.literal("DEFENSIVE"), v.literal("AGGRESSIVE")),
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
        lastUpdatedAt: v.number(),
    }),

    neutralAnalysis: defineTable({
        generalSummary: v.string(),
        generalSummaryEn: v.optional(v.string()),
        generalSummaryTh: v.optional(v.string()),
        generalSummaryKh: v.optional(v.string()),
        conflictLevel: v.string(),
        keyEvents: v.array(v.string()),
        keyEventsEn: v.optional(v.array(v.string())),
        keyEventsTh: v.optional(v.array(v.string())),
        keyEventsKh: v.optional(v.array(v.string())),
        // Stats
        displacedCount: v.optional(v.number()),
        displacedTrend: v.optional(v.number()),  // % change from 1 week ago (e.g., +300 means 300% increase)
        civilianInjuredCount: v.optional(v.number()),  // Civilian injuries
        militaryInjuredCount: v.optional(v.number()),  // Military injuries
        injuredCount: v.optional(v.number()),          // Legacy: total (kept for backwards compat)
        casualtyCount: v.optional(v.number()),         // Deaths
        lastUpdatedAt: v.number(),
    }),

    // ==================== DASHBOARD STATS ====================
    // Managed by updateDashboard - SEPARATE from synthesis
    // This stores live stats from web research, not analysis

    dashboardStats: defineTable({
        key: v.literal("main"),
        conflictLevel: v.string(),              // LOW | ELEVATED | CRITICAL
        displacedCount: v.number(),
        displacedTrend: v.number(),             // % change from 1 week ago
        civilianInjuredCount: v.number(),
        militaryInjuredCount: v.number(),
        casualtyCount: v.number(),              // Fatalities
        summary: v.optional(v.string()),        // Brief situation overview
        lastUpdatedAt: v.number(),
    })
        .index("by_key", ["key"]),

    // Historical snapshots of dashboard stats - keeps record of all updates
    dashboardHistory: defineTable({
        conflictLevel: v.string(),
        displacedCount: v.number(),
        displacedTrend: v.number(),
        civilianInjuredCount: v.number(),
        militaryInjuredCount: v.number(),
        casualtyCount: v.number(),
        summary: v.optional(v.string()),
        recordedAt: v.number(),                 // Timestamp when this snapshot was taken
    })
        .index("by_recorded_at", ["recordedAt"]),

    // ==================== ARTICLE COUNTS CACHE ====================
    // Singleton for O(1) article count reads (bandwidth optimization)
    // Updated by insertArticle/deleteArticle mutations
    articleCounts: defineTable({
        key: v.literal("main"),
        thailand: v.number(),
        cambodia: v.number(),
        international: v.number(),
        lastUpdatedAt: v.number(),
    })
        .index("by_key", ["key"]),

    // ==================== SYSTEM ====================

    systemStats: defineTable({
        key: v.string(),
        lastResearchAt: v.number(),
        totalArticlesFetched: v.number(),
        systemStatus: v.union(v.literal("online"), v.literal("syncing"), v.literal("error"), v.literal("stopped")),
        errorLog: v.optional(v.string()),
        isPaused: v.optional(v.boolean()),
        skipNextCycle: v.optional(v.boolean()), // Skip only the next cycle (auto-resets after skip)
        researchCycleCount: v.optional(v.number()), // Counter for triggering dashboard every N cycles
        // Adaptive scheduling fields
        nextRunAt: v.optional(v.number()),        // Timestamp for next cycle (set by AI)
        lastCycleInterval: v.optional(v.number()), // Hours since last cycle (for debugging)
        schedulingReason: v.optional(v.string()),  // AI's reasoning for the interval
        scheduledRunId: v.optional(v.id("_scheduled_functions")), // scheduler.runAt job ID
    })
        .index("by_key", ["key"]),

    // Track validation loop state
    validationState: defineTable({
        key: v.literal("main"),
        isRunning: v.boolean(),
        activeRunId: v.optional(v.string()), // UUID for "Highlander" locking (only one runner allowed)
        currentLoop: v.number(),           // Which iteration we're on
        lastManagerRun: v.number(),        // When manager last ran
        completionPercent: v.number(),
        currentInstruction: v.string(),
        lastUpdatedAt: v.number(),
    })
        .index("by_key", ["key"]),

    // Track source verification state (articlecred step)
    // Prevents duplicate runs and cleans up zombies
    sourceVerificationState: defineTable({
        key: v.literal("main"),
        isRunning: v.boolean(),
        runId: v.optional(v.string()),     // UUID of current run
        startedAt: v.optional(v.number()), // When run started
        lastHeartbeat: v.optional(v.number()), // Last activity (for zombie detection)
        progress: v.optional(v.string()),  // "batch 5/40"
    })
        .index("by_key", ["key"]),

    // ==================== TIMELINE EVENTS ====================
    // The "memory" of the system - key historical events extracted from news
    // This is what the AI synthesizes from, NOT raw articles
    // Designed for future frontend: timeline page with hoverable dots

    timelineEvents: defineTable({
        // Core Event Data
        date: v.string(),           // ISO date "2024-12-12" (for display/grouping)
        timeOfDay: v.optional(v.string()),  // Estimated time "08:00", "14:30", "22:00" (for ordering same-day events)
        title: v.string(),          // "Ceasefire Violated at Preah Vihear" (English)
        titleTh: v.optional(v.string()),  // Thai translation
        titleKh: v.optional(v.string()),  // Khmer translation
        description: v.string(),    // Detailed paragraph of the event (English)
        descriptionTh: v.optional(v.string()),  // Thai translation
        descriptionKh: v.optional(v.string()),  // Khmer translation
        category: v.union(
            v.literal("military"),
            v.literal("diplomatic"),
            v.literal("humanitarian"),
            v.literal("political")
        ),

        // AI-Determined Importance (0-100)
        // Higher = more significant event, more likely to appear in synthesis
        // AI decides this based on: geopolitical impact, casualty count, novelty
        importance: v.number(),

        // Verification Status
        status: v.union(
            v.literal("confirmed"),    // Verified by multiple sources
            v.literal("disputed"),     // Sources disagree
            v.literal("debunked")      // Proven false (kept for record)
        ),

        // Source Links - For verification and future deep-checks
        // Each source is a news article that contributed to this event
        sources: v.array(v.object({
            url: v.string(),           // "https://bangkokpost.com/article/123"
            name: v.string(),          // "Bangkok Post"
            country: v.string(),       // "thailand" | "cambodia" | "international"
            credibility: v.number(),   // Credibility at time of capture
            snippet: v.optional(v.string()),  // Key quote from the article
            addedAt: v.number(),       // Timestamp when this source was linked
        })),

        // Metadata
        createdAt: v.number(),
        lastUpdatedAt: v.number(),
    })
        .index("by_date", ["date"])
        .index("by_importance", ["importance"])
        .index("by_status", ["status"])
        .index("by_createdAt", ["createdAt"])
        .index("by_category", ["category"]),
});
