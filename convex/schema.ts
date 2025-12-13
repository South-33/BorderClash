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
    })
        .index("by_status", ["status"])
        .index("by_title", ["title"])
        .index("by_unreviewed", ["status", "lastReviewedAt"])
        .index("by_url", ["sourceUrl"]),

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
    })
        .index("by_status", ["status"])
        .index("by_title", ["title"])
        .index("by_unreviewed", ["status", "lastReviewedAt"])
        .index("by_url", ["sourceUrl"]),

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
    })
        .index("by_status", ["status"])
        .index("by_title", ["title"])
        .index("by_unreviewed", ["status", "lastReviewedAt"])
        .index("by_url", ["sourceUrl"]),

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


    // ==================== SYSTEM ====================

    systemStats: defineTable({
        key: v.string(),
        lastResearchAt: v.number(),
        totalArticlesFetched: v.number(),
        systemStatus: v.union(v.literal("online"), v.literal("syncing"), v.literal("error"), v.literal("stopped")),
        errorLog: v.optional(v.string()),
        isPaused: v.optional(v.boolean()),
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
});
