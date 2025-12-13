// Mock data for BorderClash demonstration
import { NewsArticle, OverviewStats, AIAnalysis, NewsSource, UpdateStatus } from "@/types";

// News Sources
export const newsSources: Record<string, NewsSource> = {
    bangkok_post: {
        id: "bangkok_post",
        name: "Bangkok Post",
        country: "TH",
        credibilityScore: 85,
        type: "media",
    },
    the_nation: {
        id: "the_nation",
        name: "The Nation Thailand",
        country: "TH",
        credibilityScore: 82,
        type: "media",
    },
    thai_pbs: {
        id: "thai_pbs",
        name: "Thai PBS",
        country: "TH",
        credibilityScore: 88,
        type: "media",
    },
    mfa_thailand: {
        id: "mfa_thailand",
        name: "Ministry of Foreign Affairs TH",
        country: "TH",
        credibilityScore: 75,
        type: "government",
    },
    khmer_times: {
        id: "khmer_times",
        name: "Khmer Times",
        country: "KH",
        credibilityScore: 78,
        type: "media",
    },
    phnom_penh_post: {
        id: "phnom_penh_post",
        name: "Phnom Penh Post",
        country: "KH",
        credibilityScore: 80,
        type: "media",
    },
    fresh_news: {
        id: "fresh_news",
        name: "Fresh News Cambodia",
        country: "KH",
        credibilityScore: 72,
        type: "media",
    },
    mfa_cambodia: {
        id: "mfa_cambodia",
        name: "Ministry of Foreign Affairs KH",
        country: "KH",
        credibilityScore: 73,
        type: "government",
    },
    reuters: {
        id: "reuters",
        name: "Reuters",
        country: "INTL",
        credibilityScore: 95,
        type: "agency",
    },
    ap_news: {
        id: "ap_news",
        name: "Associated Press",
        country: "INTL",
        credibilityScore: 94,
        type: "agency",
    },
    bbc: {
        id: "bbc",
        name: "BBC News",
        country: "INTL",
        credibilityScore: 92,
        type: "media",
    },
};

// Thai Perspective News
export const thaiNews: NewsArticle[] = [
    {
        id: "th-001",
        title: "Royal Thai Armed Forces Reinforce Border Positions",
        summary: "Military command confirms strategic repositioning of units along the disputed border region in response to provocations.",
        source: newsSources.thai_pbs,
        publishedAt: new Date(Date.now() - 1000 * 60 * 15),
        fetchedAt: new Date(),
        url: "#",
        sentiment: "neutral",
        category: "military",
        verified: true,
    },
    {
        id: "th-002",
        title: "Foreign Ministry Issues Statement on Border Incursions",
        summary: "Thailand's Ministry of Foreign Affairs condemns unauthorized crossings and calls for immediate diplomatic dialogue.",
        source: newsSources.mfa_thailand,
        publishedAt: new Date(Date.now() - 1000 * 60 * 45),
        fetchedAt: new Date(),
        url: "#",
        sentiment: "negative",
        category: "diplomatic",
        verified: true,
    },
    {
        id: "th-003",
        title: "Villagers Along Border Region Evacuated",
        summary: "Local authorities have evacuated approximately 2,500 residents from villages within 5km of the contested area.",
        source: newsSources.bangkok_post,
        publishedAt: new Date(Date.now() - 1000 * 60 * 90),
        fetchedAt: new Date(),
        url: "#",
        sentiment: "negative",
        category: "humanitarian",
        verified: true,
    },
    {
        id: "th-004",
        title: "Prime Minister Chairs Emergency Security Meeting",
        summary: "National Security Council convenes to assess situation and formulate response strategy.",
        source: newsSources.the_nation,
        publishedAt: new Date(Date.now() - 1000 * 60 * 120),
        fetchedAt: new Date(),
        url: "#",
        sentiment: "neutral",
        category: "political",
        verified: true,
    },
    {
        id: "th-005",
        title: "Historical Context: Thailand's Sovereign Claims",
        summary: "Analysis of historical treaties and territorial agreements supporting Thailand's position on the disputed region.",
        source: newsSources.bangkok_post,
        publishedAt: new Date(Date.now() - 1000 * 60 * 180),
        fetchedAt: new Date(),
        url: "#",
        sentiment: "positive",
        category: "political",
        verified: false,
    },
];

// Cambodian Perspective News
export const cambodiaNews: NewsArticle[] = [
    {
        id: "kh-001",
        title: "Royal Cambodian Armed Forces Defend National Territory",
        summary: "Military spokesperson confirms defensive operations to protect Cambodian sovereignty against incursions.",
        source: newsSources.fresh_news,
        publishedAt: new Date(Date.now() - 1000 * 60 * 20),
        fetchedAt: new Date(),
        url: "#",
        sentiment: "neutral",
        category: "military",
        verified: true,
    },
    {
        id: "kh-002",
        title: "Government Calls for International Observers",
        summary: "Cambodia requests ASEAN and UN presence to monitor border situation and document violations.",
        source: newsSources.mfa_cambodia,
        publishedAt: new Date(Date.now() - 1000 * 60 * 55),
        fetchedAt: new Date(),
        url: "#",
        sentiment: "neutral",
        category: "diplomatic",
        verified: true,
    },
    {
        id: "kh-003",
        title: "Civilians Report Shelling Near Border Communities",
        summary: "Residents in Preah Vihear province report hearing artillery fire; authorities assess damage.",
        source: newsSources.phnom_penh_post,
        publishedAt: new Date(Date.now() - 1000 * 60 * 75),
        fetchedAt: new Date(),
        url: "#",
        sentiment: "negative",
        category: "humanitarian",
        verified: true,
    },
    {
        id: "kh-004",
        title: "Foreign Minister Addresses International Community",
        summary: "Cambodia presents evidence to diplomatic corps regarding alleged Thai territorial violations.",
        source: newsSources.khmer_times,
        publishedAt: new Date(Date.now() - 1000 * 60 * 140),
        fetchedAt: new Date(),
        url: "#",
        sentiment: "negative",
        category: "diplomatic",
        verified: true,
    },
    {
        id: "kh-005",
        title: "UNESCO Heritage Site Under Threat",
        summary: "Authorities express concern over potential damage to Preah Vihear Temple due to nearby military activity.",
        source: newsSources.phnom_penh_post,
        publishedAt: new Date(Date.now() - 1000 * 60 * 200),
        fetchedAt: new Date(),
        url: "#",
        sentiment: "negative",
        category: "humanitarian",
        verified: true,
    },
];

// Overview Statistics
export const overviewStats: OverviewStats = {
    thailand: {
        casualties: {
            confirmed: 3,
            reported: 7,
            military: 3,
            civilian: 0,
            lastUpdated: new Date(Date.now() - 1000 * 60 * 30),
        },
        displacement: {
            total: 2500,
            internal: 2500,
            crossBorder: 0,
            sheltersActive: 4,
            lastUpdated: new Date(Date.now() - 1000 * 60 * 45),
        },
        damage: {
            buildingsDestroyed: 12,
            infrastructureDamaged: 3,
            estimatedCostUSD: 450000,
            areasAffected: ["Si Sa Ket Province", "Ubon Ratchathani"],
            lastUpdated: new Date(Date.now() - 1000 * 60 * 60),
        },
    },
    cambodia: {
        casualties: {
            confirmed: 2,
            reported: 5,
            military: 2,
            civilian: 0,
            lastUpdated: new Date(Date.now() - 1000 * 60 * 35),
        },
        displacement: {
            total: 1800,
            internal: 1650,
            crossBorder: 150,
            sheltersActive: 3,
            lastUpdated: new Date(Date.now() - 1000 * 60 * 50),
        },
        damage: {
            buildingsDestroyed: 8,
            infrastructureDamaged: 2,
            estimatedCostUSD: 320000,
            areasAffected: ["Preah Vihear Province", "Oddar Meanchey"],
            lastUpdated: new Date(Date.now() - 1000 * 60 * 55),
        },
    },
    combined: {
        totalCasualties: 5,
        totalDisplaced: 4300,
        conflictDays: 12,
        lastIncident: new Date(Date.now() - 1000 * 60 * 120),
    },
};

// AI Analysis
export const latestAnalysis: AIAnalysis = {
    id: "analysis-001",
    generatedAt: new Date(Date.now() - 1000 * 60 * 5),
    summary: "Current border tensions appear to stem from disputed territorial claims in the Preah Vihear region. Both nations have deployed military assets, though engagement has remained limited. International observers note escalation risk remains moderate.",
    keyFindings: [
        "Military movements on both sides consistent with defensive posturing",
        "Civilian evacuations proceeding orderly; no mass displacement crisis yet",
        "Diplomatic channels remain open through ASEAN framework",
        "Historical claims from both parties have legal basis; resolution requires negotiation",
        "International community urges de-escalation and bilateral dialogue",
    ],
    credibilityAssessment: {
        thai: 78,
        cambodia: 75,
        notes: "Both sides presenting accurate casualty figures; narrative framing differs significantly on cause and responsibility.",
    },
    recommendations: [
        "Establish immediate ceasefire through ASEAN mediation",
        "Deploy neutral observers to disputed zone",
        "Resume bilateral diplomatic committee meetings",
        "Coordinate humanitarian corridor for affected civilians",
    ],
    sourcesAnalyzed: 47,
    confidence: 82,
};

// Update Status
export const updateStatus: UpdateStatus = {
    lastUpdate: new Date(Date.now() - 1000 * 60 * 2),
    nextUpdate: new Date(Date.now() + 1000 * 60 * 3),
    isUpdating: false,
    updateInterval: 1000 * 60 * 5, // 5 minutes
    sourcesChecked: 23,
    newArticlesFound: 3,
};

// Helper function to format relative time
export function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

// Helper function to format countdown
export function formatCountdown(targetDate: Date): string {
    const now = new Date();
    const diffMs = targetDate.getTime() - now.getTime();

    if (diffMs <= 0) return "Updating...";

    const mins = Math.floor(diffMs / (1000 * 60));
    const secs = Math.floor((diffMs % (1000 * 60)) / 1000);

    return `${mins}:${secs.toString().padStart(2, "0")}`;
}
