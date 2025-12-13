// Types for BorderClash application

export interface NewsSource {
    id: string;
    name: string;
    country: "TH" | "KH" | "INTL";
    credibilityScore: number;
    logoUrl?: string;
    type: "government" | "media" | "agency" | "social";
}

export interface NewsArticle {
    id: string;
    title: string;
    summary: string;
    content?: string;
    source: NewsSource;
    publishedAt: Date;
    fetchedAt: Date;
    url: string;
    imageUrl?: string;
    sentiment: "positive" | "negative" | "neutral";
    category: "military" | "political" | "humanitarian" | "diplomatic" | "economic";
    verified: boolean;
    relatedArticleIds?: string[];
}

export interface CasualtyStats {
    confirmed: number;
    reported: number;
    military: number;
    civilian: number;
    lastUpdated: Date;
}

export interface DisplacementStats {
    total: number;
    internal: number;
    crossBorder: number;
    sheltersActive: number;
    lastUpdated: Date;
}

export interface DamageStats {
    buildingsDestroyed: number;
    infrastructureDamaged: number;
    estimatedCostUSD: number;
    areasAffected: string[];
    lastUpdated: Date;
}

export interface OverviewStats {
    thailand: {
        casualties: CasualtyStats;
        displacement: DisplacementStats;
        damage: DamageStats;
    };
    cambodia: {
        casualties: CasualtyStats;
        displacement: DisplacementStats;
        damage: DamageStats;
    };
    combined: {
        totalCasualties: number;
        totalDisplaced: number;
        conflictDays: number;
        lastIncident: Date;
    };
}

export interface AIAnalysis {
    id: string;
    generatedAt: Date;
    summary: string;
    keyFindings: string[];
    credibilityAssessment: {
        thai: number;
        cambodia: number;
        notes: string;
    };
    recommendations: string[];
    sourcesAnalyzed: number;
    confidence: number;
}

export interface UpdateStatus {
    lastUpdate: Date;
    nextUpdate: Date;
    isUpdating: boolean;
    updateInterval: number; // in milliseconds
    sourcesChecked: number;
    newArticlesFound: number;
}

export type Perspective = "cambodia" | "neutral" | "thailand";

export interface FilterOptions {
    perspective: Perspective | "all";
    category: NewsArticle["category"] | "all";
    timeRange: "1h" | "6h" | "24h" | "7d" | "30d" | "all";
    verifiedOnly: boolean;
}
