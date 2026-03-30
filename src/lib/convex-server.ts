/**
 * Server-side Convex client for ISR (Incremental Static Regeneration)
 * 
 * This allows Next.js to fetch data from Convex at build/revalidation time
 * instead of on every user request, reducing Convex bandwidth by ~99%.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

const SERVER_QUERY_RETRY_DELAYS_MS = [750, 2000] as const;

// Create a singleton HTTP client for server-side queries
const getConvexClient = () => {
    const deploymentUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!deploymentUrl) {
        throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
    }
    return new ConvexHttpClient(deploymentUrl);
};

// Type definitions for our data
export interface NewsArticle {
    _id: string;
    title: string;
    titleEn?: string;
    titleTh?: string;
    titleKh?: string;
    summary?: string;
    summaryEn?: string;
    summaryTh?: string;
    summaryKh?: string;
    sourceUrl: string;
    source: string;
    category: string;
    status: string;
    credibility: number;
    publishedAt: number;
    fetchedAt: number;
}

export interface Analysis {
    officialNarrative: string;
    officialNarrativeEn?: string;
    officialNarrativeTh?: string;
    officialNarrativeKh?: string;
    militaryIntensity: number;
    militaryPosture: "PEACEFUL" | "DEFENSIVE" | "ESCALATED" | "AGGRESSIVE";
    postureLabel?: string;
    postureLabelTh?: string;
    postureLabelKh?: string;
    postureRationale?: string;
    postureRationaleTh?: string;
    postureRationaleKh?: string;
    territorialContext?: string;
    lastUpdatedAt: number;
}

export interface DashboardStats {
    conflictLevel: string;
    displacedCount: number;
    displacedTrend: number;
    civilianInjuredCount: number;
    militaryInjuredCount: number;
    casualtyCount: number;
    summary?: string;
    lastUpdatedAt: number;
}

export interface TimelineEvent {
    _id: string;
    date: string;
    timeOfDay?: string;
    title: string;
    titleTh?: string;
    titleKh?: string;
    description: string;
    descriptionTh?: string;
    descriptionKh?: string;
    category: string;
    importance: number;
    status: string;
    sources: Array<{
        url: string;
        name: string;
        country: string;
        credibility: number;
        snippet?: string;
    }>;
    createdAt: number;
    lastUpdatedAt: number;
}

export interface SystemStats {
    lastResearchAt: number;
    nextRunAt?: number;
    lastCycleInterval?: number;
    schedulingReason?: string;
    totalArticlesFetched: number;
    systemStatus: string;
    isPaused?: boolean;
    skipNextCycle?: boolean;
}

export interface ArticleCounts {
    thailand: number;
    cambodia: number;
    international: number;
    total: number;
}

export interface BorderClashData {
    thailandNews: NewsArticle[];
    cambodiaNews: NewsArticle[];
    thailandAnalysis: Analysis | null;
    cambodiaAnalysis: Analysis | null;
    neutralAnalysis: Analysis | null;
    dashboardStats: DashboardStats | null;
    timelineEvents: TimelineEvent[];
    systemStats: SystemStats | null;
    articleCounts: ArticleCounts | null;
    fetchedAt: number;
    degraded: boolean;
    fetchWarnings: string[];
}

const summarizeError = (error: unknown): string => {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return String(error);
};

const isRetryableServerQueryError = (error: unknown): boolean => {
    const message = summarizeError(error).toLowerCase();
    return [
        "fetch failed",
        "network",
        "timeout",
        "timed out",
        "abort",
        "econnreset",
        "etimedout",
        "enotfound",
        "429",
        "rate",
        "quota",
        "temporarily unavailable",
        "bad gateway",
        "gateway timeout",
        "cloudflare",
        "server error",
    ].some((needle) => message.includes(needle));
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function queryWithRetries<T>(
    label: string,
    operation: () => Promise<T>,
    retryDelaysMs: readonly number[] = SERVER_QUERY_RETRY_DELAYS_MS,
): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            const canRetry = attempt < retryDelaysMs.length && isRetryableServerQueryError(error);
            console.warn(`[ISR] ${label} failed on attempt ${attempt + 1}/${retryDelaysMs.length + 1}: ${summarizeError(error)}`);
            if (!canRetry) {
                throw error;
            }

            await sleep(retryDelaysMs[attempt]);
        }
    }

    throw lastError;
}

async function queryWithFallback<T>(
    label: string,
    operation: () => Promise<T>,
    fallback: T,
): Promise<{ value: T; warning?: string }> {
    try {
        return {
            value: await queryWithRetries(label, operation),
        };
    } catch (error) {
        const warning = `${label}: ${summarizeError(error)}`;
        console.warn(`[ISR] ${warning}. Using fallback data for this section.`);
        return {
            value: fallback,
            warning,
        };
    }
}

/**
 * Fetch all data needed for the BorderClash dashboard
 * Called at build time and during ISR revalidation
 */
export async function fetchBorderClashData(): Promise<BorderClashData> {
    const client = getConvexClient();

    // Fetch all data in parallel, but let individual sections degrade gracefully.
    const [
        thailandNews,
        cambodiaNews,
        thailandAnalysis,
        cambodiaAnalysis,
        neutralAnalysis,
        dashboardStats,
        timelineEvents,
        systemStats,
        articleCounts,
    ] = await Promise.all([
        queryWithFallback<NewsArticle[]>(
            "Thailand news",
            () => client.query(api.api.getNewsSlim, { country: "thailand", limit: 20 }) as Promise<NewsArticle[]>,
            [],
        ),
        queryWithFallback<NewsArticle[]>(
            "Cambodia news",
            () => client.query(api.api.getNewsSlim, { country: "cambodia", limit: 20 }) as Promise<NewsArticle[]>,
            [],
        ),
        queryWithFallback<Analysis | null>(
            "Thailand analysis",
            () => client.query(api.api.getAnalysis, { target: "thailand" }) as Promise<Analysis | null>,
            null,
        ),
        queryWithFallback<Analysis | null>(
            "Cambodia analysis",
            () => client.query(api.api.getAnalysis, { target: "cambodia" }) as Promise<Analysis | null>,
            null,
        ),
        queryWithFallback<Analysis | null>(
            "Neutral analysis",
            () => client.query(api.api.getAnalysis, { target: "neutral" }) as Promise<Analysis | null>,
            null,
        ),
        queryWithFallback<DashboardStats | null>(
            "Dashboard stats",
            () => client.query(api.api.getDashboardStats, {}) as Promise<DashboardStats | null>,
            null,
        ),
        queryWithFallback<TimelineEvent[]>(
            "Timeline",
            () => client.query(api.api.getTimeline, {}) as Promise<TimelineEvent[]>,
            [],
        ),
        queryWithFallback<SystemStats | null>(
            "System stats",
            () => client.query(api.api.getStats, {}) as Promise<SystemStats | null>,
            null,
        ),
        queryWithFallback<ArticleCounts | null>(
            "Article counts",
            () => client.query(api.api.getArticleCounts, {}) as Promise<ArticleCounts | null>,
            null,
        ),
    ]);

    const queryResults = [
        thailandNews,
        cambodiaNews,
        thailandAnalysis,
        cambodiaAnalysis,
        neutralAnalysis,
        dashboardStats,
        timelineEvents,
        systemStats,
        articleCounts,
    ];
    const fetchWarnings = queryResults
        .map((result) => result.warning)
        .filter((warning): warning is string => Boolean(warning));
    const degraded = fetchWarnings.length > 0;
    const hasRenderableData = Boolean(
        thailandNews.value.length > 0 ||
        cambodiaNews.value.length > 0 ||
        thailandAnalysis.value ||
        cambodiaAnalysis.value ||
        neutralAnalysis.value ||
        dashboardStats.value ||
        timelineEvents.value.length > 0 ||
        systemStats.value ||
        articleCounts.value,
    );

    if (!hasRenderableData) {
        throw new Error(
            `BorderClash ISR data fetch failed for every section: ${fetchWarnings.join(" | ") || "unknown error"}`,
        );
    }

    if (degraded) {
        console.warn(`[ISR] Proceeding with partial snapshot (${fetchWarnings.length} degraded section(s))`);
    }

    return {
        thailandNews: thailandNews.value as NewsArticle[],
        cambodiaNews: cambodiaNews.value as NewsArticle[],
        thailandAnalysis: thailandAnalysis.value as Analysis | null,
        cambodiaAnalysis: cambodiaAnalysis.value as Analysis | null,
        neutralAnalysis: neutralAnalysis.value as Analysis | null,
        dashboardStats: dashboardStats.value as DashboardStats | null,
        timelineEvents: timelineEvents.value as TimelineEvent[],
        systemStats: systemStats.value as SystemStats | null,
        articleCounts: articleCounts.value as ArticleCounts | null,
        fetchedAt: Date.now(),
        degraded,
        fetchWarnings,
    };
}
