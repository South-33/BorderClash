/**
 * Server-side Convex client for ISR (Incremental Static Regeneration)
 * 
 * This allows Next.js to fetch data from Convex at build/revalidation time
 * instead of on every user request, reducing Convex bandwidth by ~99%.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

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
    militaryPosture: "PEACEFUL" | "DEFENSIVE" | "AGGRESSIVE";
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
}

/**
 * Fetch all data needed for the BorderClash dashboard
 * Called at build time and during ISR revalidation
 */
export async function fetchBorderClashData(): Promise<BorderClashData> {
    const client = getConvexClient();

    // Fetch all data in parallel for speed
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
        client.query(api.api.getNewsSlim, { country: "thailand", limit: 20 }),
        client.query(api.api.getNewsSlim, { country: "cambodia", limit: 20 }),
        client.query(api.api.getAnalysis, { target: "thailand" }),
        client.query(api.api.getAnalysis, { target: "cambodia" }),
        client.query(api.api.getAnalysis, { target: "neutral" }),
        client.query(api.api.getDashboardStats, {}),
        client.query(api.api.getTimeline, {}),
        client.query(api.api.getStats, {}),
        client.query(api.api.getArticleCounts, {}),
    ]);

    return {
        thailandNews: thailandNews as NewsArticle[],
        cambodiaNews: cambodiaNews as NewsArticle[],
        thailandAnalysis: thailandAnalysis as Analysis | null,
        cambodiaAnalysis: cambodiaAnalysis as Analysis | null,
        neutralAnalysis: neutralAnalysis as Analysis | null,
        dashboardStats: dashboardStats as DashboardStats | null,
        timelineEvents: (timelineEvents || []) as TimelineEvent[],
        systemStats: systemStats as SystemStats | null,
        articleCounts: articleCounts as ArticleCounts | null,
        fetchedAt: Date.now(),
    };
}
