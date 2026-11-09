import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface NewsArticle {
    _id: string;
    title: string;
    titleEn?: string;
    titleTh?: string;
    titleKh?: string;
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
    generalSummaryTh?: string;
    generalSummaryKh?: string;
    conflictLevel: string;
    keyEvents: string[];
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
        credibility: number;
    }>;
}

export interface SystemStats {
    lastResearchAt: number;
    nextRunAt?: number;
    lastCycleInterval?: number;
    schedulingReason?: string;
    systemStatus: string;
    isPaused?: boolean;
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

type DashboardSnapshot = Omit<BorderClashData, "fetchedAt">;

export async function loadDashboardData(): Promise<BorderClashData> {
    const file = join(process.cwd(), "public", "data", "dashboard.json");
    const snapshot = JSON.parse(await readFile(file, "utf8")) as DashboardSnapshot;
    return {
        ...snapshot,
        fetchedAt: snapshot.systemStats?.lastResearchAt ?? 0,
    };
}
