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
    narrativeSource?: string;
    militaryIntensity: number;
    militaryPosture: "PEACEFUL" | "DEFENSIVE" | "ESCALATED" | "AGGRESSIVE";
    postureLabel?: string;
    postureLabelTh?: string;
    postureLabelKh?: string;
    postureRationale?: string;
    postureRationaleTh?: string;
    postureRationaleKh?: string;
    territorialContext?: "OWN_TERRITORY" | "DISPUTED_ZONE" | "FOREIGN_TERRITORY" | "BORDER_ZONE";
    lastUpdatedAt: number;
}

export interface NeutralAnalysis {
    generalSummary: string;
    generalSummaryEn?: string;
    generalSummaryTh?: string;
    generalSummaryKh?: string;
    conflictLevel: string;
    keyEvents: string[];
    keyEventsEn?: string[];
    keyEventsTh?: string[];
    keyEventsKh?: string[];
    displacedCount?: number;
    displacedTrend?: number;
    civilianInjuredCount?: number;
    militaryInjuredCount?: number;
    injuredCount?: number;
    casualtyCount?: number;
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
    totalArticlesFetched?: number;
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
    neutralAnalysis: NeutralAnalysis | null;
    dashboardStats: DashboardStats | null;
    timelineEvents: TimelineEvent[];
    systemStats: SystemStats | null;
    articleCounts: ArticleCounts | null;
    fetchedAt: number;
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

/**
 * Fetch all data needed for the BorderClash dashboard
 * Called at build time and during ISR revalidation
 */
export async function fetchBorderClashData(): Promise<BorderClashData> {
    const client = getConvexClient();
    const snapshot = await queryWithRetries<Omit<BorderClashData, "fetchedAt">>(
        "Dashboard snapshot",
        () => client.query(api.api.getDashboardSnapshot, {}) as Promise<Omit<BorderClashData, "fetchedAt">>,
    );

    return {
        ...snapshot,
        fetchedAt: Date.now(),
    };
}
