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

export interface Perspective {
    summary: string;
    summaryTh?: string;
    summaryKh?: string;
    sourceNames: string[];
    activityLabel?: string;
    activityLabelTh?: string;
    activityLabelKh?: string;
    activityDetails?: string;
    activityDetailsTh?: string;
    activityDetailsKh?: string;
    updatedAt: number;
}

export interface CurrentSummary {
    summary: string;
    summaryTh?: string;
    summaryKh?: string;
    keyUpdates: string[];
    keyUpdatesTh?: string[];
    keyUpdatesKh?: string[];
    updatedAt: number;
}

export interface Impact {
    displaced: ImpactMetric;
    deaths: ImpactMetric;
    injuries: ImpactMetric;
    updatedAt: number;
}

export interface ImpactMetric {
    value: number | null;
    qualifier: "MORE_THAN" | "AT_LEAST" | "NO_COMBINED_TOTAL";
    claimantName?: string;
    claimantNameTh?: string;
    claimantNameKh?: string;
    sourceName?: string;
    sourceUrl?: string;
    sourceDate?: string;
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

export interface ResearchState {
    lastResearchAt: number;
    nextRunAt?: number;
    intervalHours?: number;
    reason?: string;
    status: string;
    paused?: boolean;
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
    thailandPerspective: Perspective | null;
    cambodiaPerspective: Perspective | null;
    summary: CurrentSummary | null;
    impact: Impact | null;
    timelineEvents: TimelineEvent[];
    researchState: ResearchState | null;
    articleCounts: ArticleCounts | null;
    snapshotAt: number;
}

type DashboardSnapshot = Omit<BorderClashData, "snapshotAt">;

export async function loadDashboardData(): Promise<BorderClashData> {
    const file = join(process.cwd(), "public", "data", "dashboard.json");
    const snapshot = JSON.parse(await readFile(file, "utf8")) as DashboardSnapshot;
    return {
        ...snapshot,
        snapshotAt: snapshot.researchState?.lastResearchAt ?? 0,
    };
}
