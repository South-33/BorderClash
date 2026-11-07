"use node";

import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
    callGeminiStudio,
    formatTimelineEvent,
    isCompletedGeminiFailure,
    repairLocalizedItems,
    type LocalizedRepairItem,
} from "./ai_utils";
import { GEMINI_THINKING } from "./config";
import { LOCALIZED_WRITING_RULES, isValidLocalizedText } from "./language_quality";
import { canonicalizeArticleUrl } from "./dedupe";


// =============================================================================
// HISTORIAN PROMPT
// The "thinking" analyst that decides what becomes a timeline event
// =============================================================================

const HISTORIAN_PROMPT = `You maintain BorderClash's permanent Thailand-Cambodia timeline.

Use only the supplied article records and timeline context. Treat every side's claims with equal skepticism. Do not invent facts, dates, places, units, quotes, or verification. If evidence is weak or only describes commentary, archive it instead of creating an event.

Keep only historically useful events: combat, territorial changes, signed agreements, major humanitarian milestones, or discrete confirmed casualty incidents. Merge repeated reporting into an existing event. Use 70+ importance only for developments that materially change the conflict story.

${LOCALIZED_WRITING_RULES}

Actions:
- create_event: a new, well-supported timeline event.
- merge_source: the article supports an existing event.
- update_event: the article materially corrects or improves an existing event.
- delete_event: an existing event is proven false or is a duplicate.
- archive: real but not timeline-worthy, including reactions and routine status reports.
- discard: broken, irrelevant, or unusable material.
- flag_conflict: credible evidence contradicts the timeline and needs review.

For dates use YYYY-MM-DD and optional HH:MM. Keep titles concise and descriptions to 2 short sentences.

Return EXACTLY one fenced \`\`\`json code block and nothing else.

\`\`\`json
{
  "actions": [
    {
      "articleTitle": "Exact title from input",
      "action": "create_event|merge_source|update_event|archive|discard|flag_conflict|delete_event",
      "articleTranslations": {
        "titleTh": "Natural Thai translation of the input article title",
        "titleKh": "Natural Khmer translation of the input article title",
        "summaryTh": "Natural Thai translation of the input article summary",
        "summaryKh": "Natural Khmer translation of the input article summary"
      },
      "eventData": {
        "date": "YYYY-MM-DD",
        "timeOfDay": "HH:MM",
        "title": "English title",
        "titleTh": "Thai translation",
        "titleKh": "Khmer translation",
        "description": "English description",
        "descriptionTh": "Thai translation",
        "descriptionKh": "Khmer translation",
        "category": "military|diplomatic|humanitarian|political",
        "importance": 0,
        "sourceSnippet": "Short source-supported phrase"
      },
      "targetEventTitle": "Exact existing timeline title when needed",
      "eventUpdates": {},
      "reasoning": "Brief reason"
    }
  ],
  "summary": "Brief batch summary"
}
\`\`\`

Rules:
- Every supplied article must have one action.
- Every action must include articleTranslations for the supplied article title and summary.
- update_event and delete_event require targetEventTitle and reasoning.
- Output valid JSON only inside the fence.
`;

// =============================================================================
// PLANNER PROMPT
// Phase 1: Sees ALL articles, picks up to 10 most important to process
// =============================================================================

function extractJsonPayload(raw: string): string | null {
    const fencedMatch = raw.match(/```json\s*([\s\S]*?)```/i);
    if (fencedMatch) return fencedMatch[1].trim();

    const tagMatch = raw.match(/<json>([\s\S]*?)<\/json>/i);
    if (tagMatch) return tagMatch[1].trim();

    const firstOpen = raw.indexOf("{");
    const lastClose = raw.lastIndexOf("}");
    if (firstOpen !== -1 && lastClose !== -1) {
        return raw.substring(firstOpen, lastClose + 1).trim();
    }

    return null;
}

function normalizeJsonCandidate(input: string): string {
    const trimmed = input.trim();
    let normalized = trimmed;

    if (trimmed.startsWith("\"")) {
        try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed === "string") {
                normalized = parsed;
            }
        } catch {
            normalized = trimmed;
        }
    }

    for (let i = 0; i < 2; i++) {
        normalized = normalized
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
            .replace(/\\<json>/gi, "<json>")
            .replace(/\\<\/json>/gi, "</json>")
            .replace(/"\[([^\]]*)\]\(([^)]+)\)"/g, "\"$2\"")
            .replace(/,\s*([\]\}])/g, "$1")
            .replace(/[\uFEFF\u200B\u200C\u200D]/g, "")
            .replace(/\\(?=[!<>&`])/g, "")
            .replace(/\\(?![\"\\/bfnrtu])/g, "\\\\");
    }

    return normalized.trim();
}

// =============================================================================
// PLANNER RUNNER
// Selects which articles to process from the full queue
// =============================================================================

// =============================================================================
// HISTORIAN RUNNER
// Processes a batch of articles against the timeline
// =============================================================================


interface HistorianAction {
    articleTitle: string;
    action: "create_event" | "merge_source" | "archive" | "discard" | "flag_conflict" | "update_event" | "delete_event";
    articleTranslations?: {
        titleTh?: string;
        titleKh?: string;
        summaryTh?: string;
        summaryKh?: string;
    };
    eventData?: {
        date: string;
        timeOfDay?: string;  // Estimated time "08:00", "14:30", "22:00" for ordering
        title: string;
        titleTh?: string;  // Thai translation (casual)
        titleKh?: string;  // Khmer translation (casual)
        description: string;
        descriptionTh?: string;  // Thai translation (casual)
        descriptionKh?: string;  // Khmer translation (casual)
        category: "military" | "diplomatic" | "humanitarian" | "political";
        importance: number;
        sourceSnippet?: string;
    };
    targetEventTitle?: string;  // Used for merge_source, update_event, delete_event
    eventUpdates?: {  // Used for update_event - partial updates
        title?: string;
        titleTh?: string;
        titleKh?: string;
        description?: string;
        descriptionTh?: string;
        descriptionKh?: string;
        date?: string;
        timeOfDay?: string;  // Update estimated time
        category?: "military" | "diplomatic" | "humanitarian" | "political";
        importance?: number;
        status?: "confirmed" | "disputed" | "debunked";
    };
    sourceSnippet?: string;
    reasoning?: string;  // Required for update_event and delete_event
}

interface HistorianResult {
    actions: HistorianAction[];
    summary?: string;
}

type HistorianLocalizedTarget = {
    title?: string;
    titleTh?: string;
    titleKh?: string;
    summary?: string;
    summaryTh?: string;
    summaryKh?: string;
    description?: string;
    descriptionTh?: string;
    descriptionKh?: string;
};

function decodeHtmlEntities(str: string): string {
    if (!str) return "";
    return str
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'");
}

async function repairHistorianLocalizations(
    result: HistorianResult,
    articles: Array<{ title: string; summary?: string }>,
    timeoutMs?: number,
): Promise<{ requested: number; repaired: number }> {
    const items: LocalizedRepairItem[] = [];
    const targets = new Map<string, {
        target: HistorianLocalizedTarget;
        thaiField: keyof HistorianLocalizedTarget;
        khmerField: keyof HistorianLocalizedTarget;
    }>();

    const addPair = (
        id: string,
        target: HistorianLocalizedTarget,
        english: unknown,
        thaiField: keyof HistorianLocalizedTarget,
        khmerField: keyof HistorianLocalizedTarget,
        requireBoth: boolean,
    ) => {
        if (typeof english !== "string" || !english.trim()) return;
        const repair: Array<"th" | "kh"> = [];
        if ((requireBoth || target[thaiField] !== undefined) && !isValidLocalizedText(target[thaiField], "th")) repair.push("th");
        if ((requireBoth || target[khmerField] !== undefined) && !isValidLocalizedText(target[khmerField], "kh")) repair.push("kh");
        if (repair.length === 0) return;

        items.push({
            id,
            english,
            repair,
        });
        targets.set(id, { target, thaiField, khmerField });
    };

    result.actions.forEach((action, index) => {
        const articleTitle = decodeHtmlEntities(action.articleTitle || "");
        const sourceArticle = articles.find((article) => article.title === articleTitle);
        if (sourceArticle) {
            action.articleTranslations ??= {};
            addPair(
                `${index}:article-title`,
                action.articleTranslations,
                sourceArticle.title,
                "titleTh",
                "titleKh",
                true,
            );
            addPair(
                `${index}:article-summary`,
                action.articleTranslations,
                sourceArticle.summary || sourceArticle.title,
                "summaryTh",
                "summaryKh",
                true,
            );
        }

        if (action.action === "create_event" && action.eventData) {
            addPair(`${index}:title`, action.eventData, action.eventData.title, "titleTh", "titleKh", true);
            addPair(`${index}:description`, action.eventData, action.eventData.description, "descriptionTh", "descriptionKh", true);
        }
        if (action.action === "update_event" && action.eventUpdates) {
            const updates = action.eventUpdates;
            addPair(`${index}:update-title`, updates, updates.title, "titleTh", "titleKh", updates.title !== undefined);
            addPair(`${index}:update-description`, updates, updates.description, "descriptionTh", "descriptionKh", updates.description !== undefined);
        }
    });

    if (items.length === 0) return { requested: 0, repaired: 0 };

    const repaired = await repairLocalizedItems(items, timeoutMs);
    let repairedFields = 0;
    for (const item of items) {
        const target = targets.get(item.id);
        const fixed = repaired.get(item.id);
        if (!target || !fixed) continue;

        if (item.repair.includes("th") && fixed.thai) {
            target.target[target.thaiField] = fixed.thai;
            repairedFields++;
        }
        if (item.repair.includes("kh") && fixed.khmer) {
            target.target[target.khmerField] = fixed.khmer;
            repairedFields++;
        }
    }

    console.warn(`[HISTORIAN] localization_repair requestedFields=${items.reduce((sum, item) => sum + item.repair.length, 0)} repairedFields=${repairedFields}`);
    return { requested: items.reduce((sum, item) => sum + item.repair.length, 0), repaired: repairedFields };
}

async function runHistorian(
    articles: Array<{
        title: string;
        country: string;
        source: string;
        sourceUrl: string;
        summary?: string;
        credibility: number;
        publishedAt?: number;
    }>,
    existingTimeline: Array<{
        date: string;
        timeOfDay?: string;  // For chronological ordering
        title: string;
        description: string;
        category: string;
        importance: number;
        status: string;
        sources: Array<{
            url: string;
            name: string;
            country: string;
            credibility?: number;
            snippet?: string;
        }>;
    }>,
    timeoutMs?: number
): Promise<HistorianResult | null> {

    // Build article context with publication dates
    const articlesContext = articles.map((a, i) => {
        const pubDate = a.publishedAt ? new Date(a.publishedAt).toISOString().split('T')[0] : 'unknown';
        return `${i + 1}. [${a.country.toUpperCase()}] "${a.title}"
   Published: ${pubDate} | Source: ${a.source} | Credibility: ${a.credibility}/100
   Summary: ${a.summary || "(no summary)"}`;
    }).join("\n\n");

    // Build timeline context using shared helper
    const timelineContext = existingTimeline.length > 0
        ? existingTimeline.map((e: any) => formatTimelineEvent(e)).join("\n\n")
        : "(Timeline is empty)";

    const prompt = `${HISTORIAN_PROMPT}

NEW ARTICLES (${articles.length}):
${articlesContext}

EXISTING TIMELINE (${existingTimeline.length} events):
${timelineContext}

Process every article and return the JSON decisions.`;
    console.log(`[HISTORIAN] request articles=${articles.length} timeline=${existingTimeline.length} promptChars=${prompt.length}`);

    // Helper to clean and parse JSON with multiple fallback strategies
    const tryParseJson = (jsonStr: string): HistorianResult | null => {
        try { return JSON.parse(normalizeJsonCandidate(jsonStr)); } catch { /* continue */ }
        try {
            const cleaned = normalizeJsonCandidate(jsonStr)
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
                .replace(/,\s*([\]\}])/g, '$1');
            return JSON.parse(cleaned);
        } catch { /* continue */ }
        try {
            const escaped = jsonStr.replace(
                /"([^"\\]|\\.)*"/g,
                (match) => match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
            );
            const cleaned = escaped
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
                .replace(/,\s*([\]\}])/g, '$1');
            return JSON.parse(cleaned);
        } catch { /* continue */ }
        return null;
    };

    // RETRY LOOP (2 attempts)
    const MAX_RETRIES = 2;
    let currentPrompt = prompt;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 1) {
            console.log(`[HISTORIAN] retrying attempt=${attempt}/${MAX_RETRIES}`);
        }

        try {
            const response = await callGeminiStudio(currentPrompt, {
                thinkingLevel: GEMINI_THINKING.historian,
                timeoutMs,
                useSearch: false,
            });

            // Extract JSON from response
            const jsonStr = extractJsonPayload(response);

            if (!jsonStr) {
                console.warn(`[HISTORIAN] no_json attempt=${attempt}/${MAX_RETRIES}`);
                if (attempt < MAX_RETRIES) {
                    currentPrompt = "Your response had no valid JSON. Output ONLY one fenced ```json code block with {\"actions\": [{\"articleTitle\": \"...\", \"action\": \"create_event|archive|discard\", \"eventData\": {...}}], \"summary\": \"...\"}. Process the articles you already saw.";
                    continue;
                }
                return null;
            }

            // Try to parse
            let result = tryParseJson(jsonStr);

            // If parse failed, try AI repair
            if (!result) {
                console.warn(`[HISTORIAN] json_parse_failed attempt=${attempt}/${MAX_RETRIES} repair=true`);
                try {
                    const repairPrompt = `Fix this broken JSON and output ONLY one fenced \`\`\`json code block:\n\n${jsonStr.substring(0, 2000)}`;
                    const repairResponse = await callGeminiStudio(repairPrompt, {
                        thinkingLevel: GEMINI_THINKING.repair,
                        timeoutMs,
                    });
                    const repairedJson = extractJsonPayload(repairResponse);
                    if (repairedJson) {
                        result = tryParseJson(repairedJson);
                        if (result) console.log("[HISTORIAN] json_repaired=true");
                    }
                } catch (repairError) {
                    console.warn(`[HISTORIAN] json_repair_failed error=${repairError}`);
                }
            }

            // Validate result structure
            if (result && result.actions && Array.isArray(result.actions)) {
                return result;
            }

            console.warn(`[HISTORIAN] invalid_structure attempt=${attempt}/${MAX_RETRIES} missing=actions`);
            if (attempt < MAX_RETRIES) {
                currentPrompt = "Wrong format. Output ONLY one fenced ```json code block with {\"actions\": [{\"articleTitle\": \"...\", \"action\": \"...\", \"eventData\": {...}}], \"summary\": \"...\"}.";
            }
        } catch (error) {
            // Network error - wait before retry
            console.warn(`[HISTORIAN] network_error attempt=${attempt}/${MAX_RETRIES} error=${error}`);
            if (isCompletedGeminiFailure(error)) {
                console.warn("[HISTORIAN] server_retry_budget_exhausted localRetry=false");
                break;
            }
            if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, 5000));
                currentPrompt = prompt; // Reset to original for network retries
            }
        }
    }

    console.warn("[HISTORIAN] exhausted preservedExisting=true");
    return null;
}

// =============================================================================
// MAIN HISTORIAN ACTION
// Two-phase approach: Planner picks, Historian processes
// =============================================================================

export type HistorianCycleResult = {
    processed: number;
    eventsCreated: number;
    eventsUpdated?: number;
    eventsDeleted?: number;
    sourcesMerged?: number;
    archived: number;
    discarded?: number;
    conflictsFlagged?: number;
    missingActions?: number;
    actionWarnings?: number;
};

export async function runHistorianCycleInternal(
    ctx: any,
    { cachedTimeline }: {
        cachedTimeline?: any[];
    },
): Promise<HistorianCycleResult> {
    // 1. Get ALL unprocessed articles (not just 10)
    const allArticles = await ctx.runQuery(internal.api.getUnprocessedForTimeline, {
        batchSize: 200,  // Get all of them
    });

    if (allArticles.length === 0) {
        console.log("[HISTORIAN] idle unprocessed=0");
        return { processed: 0, eventsCreated: 0, archived: 0 };
    }

    // 2. Get existing timeline for context (use cache if provided)
    const timeline = cachedTimeline ?? await ctx.runQuery(internal.api.getRecentTimelineContextForHistorian, {
        limit: 12  // Bounded context keeps the browser generation reliable
    });

    // 3. Get timeline stats (always fresh - small query)
    const timelineStats = await ctx.runQuery(internal.api.getTimelineStats, {});

    // Processed-news context duplicates the timeline and made each browser request much larger.
    const articleGroupKey = (article: any) => canonicalizeArticleUrl(article.sourceUrl)
        || `${article.source || ""}|${article.title || ""}`.toLowerCase().trim();
    const articleGroups = new Map<string, any[]>();
    const uniqueArticles: any[] = [];
    for (const article of allArticles) {
        const key = articleGroupKey(article);
        const group = articleGroups.get(key);
        if (group) {
            group.push(article);
        } else {
            articleGroups.set(key, [article]);
            uniqueArticles.push(article);
        }
    }

    console.log(`[HISTORIAN] context unprocessed=${allArticles.length} unique=${uniqueArticles.length} duplicateRows=${allArticles.length - uniqueArticles.length} timeline=${timeline.length} totalEvents=${timelineStats.totalEvents} avgImportance=${timelineStats.avgImportance} cachedTimeline=${cachedTimeline ? "true" : "false"}`);

    // The query is already credibility-sorted. Process a bounded batch of
    // unique source stories; cross-feed duplicates are handled with the same
    // decision and never consume another Gemini slot.
    const historianBatchSize = 3;
    const selectedArticles = uniqueArticles.slice(0, historianBatchSize);

    // ====================================================================
    // PHASE 2: HISTORIAN - Process the selected articles
    // ====================================================================
    const historianResult = await runHistorian(
        selectedArticles.map((a: any) => ({
            title: a.title,
            country: a.country,
            source: a.source,
            sourceUrl: a.sourceUrl,
            summary: a.summary || a.summaryEn,
            credibility: a.credibility,
            publishedAt: a.publishedAt,
        })),
        timeline.map((t: any) => ({
            date: t.date,
            timeOfDay: t.timeOfDay,  // For chronological display
            title: t.title,
            description: t.description,
            category: t.category,
            importance: t.importance,
            status: t.status,
            sources: t.sources.map((s: any) => ({
                url: s.url,
                name: s.name,
                country: s.country,
                credibility: s.credibility,  // For sorting top sources
                snippet: s.snippet,
            })),
        }))
    );


    if (!historianResult || !historianResult.actions) {
        console.warn("[HISTORIAN] no_valid_result preservedExisting=true");
        return { processed: 0, eventsCreated: 0, eventsUpdated: 0, sourcesMerged: 0, archived: 0, discarded: 0 };
    }

    await repairHistorianLocalizations(historianResult, selectedArticles);

    // 5. Execute actions
    let eventsCreated = 0;
    let eventsUpdated = 0;
    let eventsDeleted = 0;
    let sourcesMerged = 0;
    let archived = 0;
    let discarded = 0;
    let conflictsFlagged = 0;
    let missingActions = 0;
    let actionWarnings = 0;

    const returnedTitles = new Set<string>();

    for (const action of historianResult.actions) {
        // Safety check for missing title
        if (!action.articleTitle) {
            actionWarnings++;
            continue;
        }

        // Decode HTML entities in the article title from AI response
        const searchTitle = decodeHtmlEntities(action.articleTitle);
        returnedTitles.add(searchTitle);
        const article = selectedArticles.find((a: any) => a.title === searchTitle);
        if (!article) {
            actionWarnings++;
            continue;
        }
        const articleGroup = articleGroups.get(articleGroupKey(article)) ?? [article];

        try {
            switch (action.action) {
            case "create_event":
                if (action.eventData) {
                    // Validate category - AI might return invalid values
                    const validCategories = ["military", "diplomatic", "humanitarian", "political"] as const;
                    const rawCategory = action.eventData.category?.toLowerCase() || "political";
                    const category = validCategories.includes(rawCategory as typeof validCategories[number])
                        ? rawCategory as typeof validCategories[number]
                        : "political";  // fallback for invalid categories like "cultural"

                    // Create new timeline event with translations
                    await ctx.runMutation(internal.api.createTimelineEvent, {
                        date: action.eventData.date || new Date().toISOString().split('T')[0],
                        timeOfDay: action.eventData.timeOfDay || "12:00",  // Default to midday if not specified
                        title: action.eventData.title,
                        titleTh: action.eventData.titleTh,
                        titleKh: action.eventData.titleKh,
                        description: action.eventData.description,
                        descriptionTh: action.eventData.descriptionTh,
                        descriptionKh: action.eventData.descriptionKh,
                        category,
                        importance: action.eventData.importance || 50,
                        sources: [{
                            url: article.sourceUrl,
                            name: article.source,
                            country: article.country,
                            credibility: article.credibility,
                            snippet: action.eventData.sourceSnippet,
                        }],
                        });
                    eventsCreated++;
                }
                break;

            case "merge_source":
                if (action.targetEventTitle) {
                    const articleDate = article.publishedAt
                        ? new Date(article.publishedAt).toISOString().split('T')[0]
                        : new Date().toISOString().split('T')[0];

                    const startDate = new Date(articleDate);
                    startDate.setDate(startDate.getDate() - 7);
                    const endDate = new Date(articleDate);
                    endDate.setDate(endDate.getDate() + 7);

                    // Find the event to merge into
                    const matchingEvents = await ctx.runQuery(internal.api.findEventByTitleAndDate, {
                        title: action.targetEventTitle,
                        dateRange: {
                            start: startDate.toISOString().split('T')[0],
                            end: endDate.toISOString().split('T')[0],
                        },
                        });

                    if (matchingEvents.length > 0) {
                        await ctx.runMutation(internal.api.addSourceToEvent, {
                            eventId: matchingEvents[0]._id,
                            source: {
                                url: article.sourceUrl,
                                name: article.source,
                                country: article.country,
                                credibility: article.credibility,
                                snippet: action.sourceSnippet,
                            },
                            });
                        sourcesMerged++;
                    } else {
                        actionWarnings++;
                    }
                }
                break;

            case "archive":
                // Archive = mark as processed but not timeline-worthy
                for (const duplicate of articleGroup) {
                    await ctx.runMutation(internal.api.flagArticle, {
                        country: duplicate.country as "thailand" | "cambodia" | "international",
                        title: duplicate.title,
                        status: "archived",
                    });
                    archived++;
                }
                break;

            case "discard":
                // Discard = mark as false (bad data)
                for (const duplicate of articleGroup) {
                    await ctx.runMutation(internal.api.flagArticle, {
                        country: duplicate.country as "thailand" | "cambodia" | "international",
                        title: duplicate.title,
                        status: "false",
                    });
                    discarded++;
                }
                break;

            case "update_event":
                // Update an existing timeline event with new info
                if (action.targetEventTitle && action.eventUpdates) {
                    // ONLY allow fields that are in the validator - strip everything else
                    // This prevents AI from breaking the mutation with extra fields like 'sourceSnippet'
                    const validFields = ['title', 'titleTh', 'titleKh', 'description', 'descriptionTh', 'descriptionKh', 'date', 'timeOfDay', 'category', 'importance', 'status'];
                    const updates: any = {};
                    for (const field of validFields) {
                        if ((action.eventUpdates as any)[field] !== undefined) {
                            updates[field] = (action.eventUpdates as any)[field];
                        }
                    }

                    // Validate category if provided
                    if (updates.category) {
                        const validCategories = ["military", "diplomatic", "humanitarian", "political"];
                        if (!validCategories.includes(updates.category)) {
                            updates.category = undefined; // Invalid, don't update
                        }
                    }
                    if (updates.status) {
                        const validStatuses = ["confirmed", "disputed", "debunked"];
                        if (!validStatuses.includes(updates.status)) {
                            updates.status = undefined; // Invalid, don't update
                        }
                    }

                    await ctx.runMutation(internal.api.updateTimelineEvent, {
                        eventTitle: action.targetEventTitle,
                        updates,
                        reason: action.reasoning || "Updated by Historian based on new information",
                        });
                    eventsUpdated++;
                } else {
                    actionWarnings++;
                }
                break;

            case "flag_conflict":
                // Mark for deeper investigation
                for (const duplicate of articleGroup) {
                    await ctx.runMutation(internal.api.updateArticleValidation, {
                        country: duplicate.country as "thailand" | "cambodia" | "international",
                        title: duplicate.title,
                        hasConflict: true,
                        conflictsWith: action.targetEventTitle,
                    });
                    conflictsFlagged++;
                }
                break;

            case "delete_event":
                // DELETE an existing timeline event - USE EXTREMELY RARELY
                if (action.targetEventTitle && action.reasoning) {
                    await ctx.runMutation(internal.api.deleteTimelineEvent, {
                        eventTitle: action.targetEventTitle,
                        reason: action.reasoning,
                        });
                    eventsDeleted++;
                } else {
                    actionWarnings++;
                }
                break;

            default:
                actionWarnings++;
                break;
        }

        const translations = action.articleTranslations;
        if (translations) {
            const translationsValid =
                isValidLocalizedText(translations.titleTh, "th") &&
                isValidLocalizedText(translations.titleKh, "kh") &&
                isValidLocalizedText(translations.summaryTh, "th") &&
                isValidLocalizedText(translations.summaryKh, "kh");

            if (translationsValid) {
                try {
                    for (const duplicate of articleGroup) {
                        await ctx.runMutation(internal.api.updateArticleContent, {
                            country: duplicate.country as "thailand" | "cambodia" | "international",
                            oldTitle: duplicate.title,
                            newTitleTh: translations.titleTh,
                            newTitleKh: translations.titleKh,
                            newSummaryTh: translations.summaryTh,
                            newSummaryKh: translations.summaryKh,
                        });
                    }
                } catch (translationError) {
                    actionWarnings++;
                    console.warn(`[HISTORIAN] Article localization save failed for "${article.title}": ${translationError}`);
                }
            } else {
                actionWarnings++;
                console.warn(`[HISTORIAN] Article localization missing or invalid for "${article.title}"; English fallback preserved`);
            }
        }

        // Mark article as processed by Historian (regardless of action taken)
        for (const duplicate of articleGroup) {
            await ctx.runMutation(internal.api.markAsProcessedToTimeline, {
                country: duplicate.country as "thailand" | "cambodia" | "international",
                title: duplicate.title,
            });
        }
        } catch (error) {
            actionWarnings++;
            console.error(`[HISTORIAN] Failed to apply action "${action.action}" for "${article.title}":`, error);
            continue;
        }
    }

    // IMPORTANT: Also mark any selected articles that the AI forgot to include in its response
    // This prevents "orphaned" articles from being reprocessed forever
    // Decode HTML entities to match consistently with the action processing above
    const processedTitles = returnedTitles;
    for (const article of selectedArticles) {
        if (!processedTitles.has(article.title)) {
            missingActions++;
            const articleGroup = articleGroups.get(articleGroupKey(article)) ?? [article];
            for (const duplicate of articleGroup) {
                await ctx.runMutation(internal.api.markAsProcessedToTimeline, {
                    country: duplicate.country as "thailand" | "cambodia" | "international",
                    title: duplicate.title,
                });
            }
        }
    }

    const processedRows = selectedArticles.reduce(
        (sum: number, article: any) => sum + (articleGroups.get(articleGroupKey(article))?.length ?? 1),
        0,
    );
    console.log(`[HISTORIAN] complete unprocessed=${allArticles.length} unique=${uniqueArticles.length} selected=${selectedArticles.length} processedRows=${processedRows} actions=${historianResult.actions.length} created=${eventsCreated} updated=${eventsUpdated} deleted=${eventsDeleted} merged=${sourcesMerged} archived=${archived} discarded=${discarded} conflicts=${conflictsFlagged} missingActions=${missingActions} warnings=${actionWarnings}`);

    return {
        processed: processedRows,
        eventsCreated,
        eventsUpdated,
        eventsDeleted,
        sourcesMerged,
        archived,
        discarded,
        conflictsFlagged,
        missingActions,
        actionWarnings,
    };

}

export const runHistorianCycle = internalAction({
    args: {
        // Optional cached data to reduce bandwidth when called in a loop
        cachedTimeline: v.optional(v.array(v.any())),
    },
    handler: async (ctx, args): Promise<HistorianCycleResult> => await runHistorianCycleInternal(ctx, args),
});

// =============================================================================
// TIMELINE IMPORTANCE RESCORE (RETROACTIVE)
// Rewrites importance values for all timeline events in tracked batches
// =============================================================================

type ImpactRescoreEvent = {
    _id: Id<"timelineEvents">;
    date: string;
    timeOfDay?: string;
    title: string;
    description: string;
    category: "military" | "diplomatic" | "humanitarian" | "political";
    importance: number;
    status: "confirmed" | "disputed" | "debunked";
    createdAt?: number;
    impactRescoreProcessed?: boolean;
    sources?: Array<{
        name: string;
        country: string;
        credibility: number;
    }>;
};

type ImpactRescoreDecision = {
    eventId: string;
    importance: number;
    reason?: string;
};

type ImpactRescoreResult = {
    scores: ImpactRescoreDecision[];
    reasoning?: string;
    summary?: string;
};

const IMPACT_RESCORE_PROMPT = `You are recalibrating timeline importance scores for BorderClash.

Goal: make importance useful for "Key events only" filtering where key = importance >= 70.
You are NOT creating, deleting, or merging events. Only rescore importance.

OPERATING STANCE:
- Be neutral and evidence-first.
- Avoid favoring any country, institution, or narrative style.
- Prefer conservative scoring when evidence is weak or one-sided.

INPUT ASSUMPTIONS:
- Events and source metadata are already pre-processed by a prior verification pipeline.
- You should not re-verify URLs or invent missing evidence.
- Use provided source credibility and source diversity as confidence signals.

SCORING RUBRIC (STRICT):
- 90-100: Rare, conflict-defining transitions that materially change trajectory.
- 80-89: Major strategic shifts with clear cross-domain consequences.
- 70-79: Story-critical state changes required for coherent understanding.
- 60-69: Meaningful supporting developments.
- 40-59: Minor, repetitive, or mostly reactive developments.
- 0-39: Low-signal, weakly evidenced, or non-substantive items.

RULES:
1) Score every event in CURRENT BATCH.
2) Use only factual impact, not writing style.
3) Repeated updates on the same issue should usually score lower unless they add decisive new facts.
4) Running totals (displaced/casualties) get 70+ only when they reflect major milestone/state change.
5) Be internally consistent with the LOOKBACK CONTEXT (already rescored chronological history).
6) Stay neutral across all sides; treat official claims from every country with equal skepticism.
7) Use source quality signals: broader high-credibility corroboration can raise confidence; disputed/debunked events should usually score lower unless strongly evidenced.

CALIBRATION GUARDRAILS:
- 70+ should usually be a minority of events in a batch. Use 70+ only when loss of that event would break the conflict narrative.
- If uncertain between two ranges, choose the lower range.
- Do not use 70 as a default compromise score. If borderline, prefer 66-69.
- For 70+, require clear narrative necessity: a strategic state change, a formal state-level decision/action with real downstream effects, or a major verified humanitarian/military milestone.
- Milestone novelty rule: the FIRST report of a major milestone may be 70+, but follow-up confirmations of the same milestone should usually be 55-69 unless they introduce a materially new consequence.
- Avoid milestone duplication inflation: repeated percentage/total updates (returns, displacement, casualties) should score lower unless magnitude, policy, or operational reality clearly changes.
- Post-ceasefire/stabilization phases should be scored more conservatively: routine inspections, repeated protests, and recurring advisories are usually supporting context unless they trigger a new strategic state.
- Single-source or one-sided allegation events should usually stay below 70 unless independently corroborated or directly evidenced.
- Disputed events should usually remain below 70 unless there is strong multi-source confirmation of core facts.
- Debunked events should be low (typically 0-25).
- Repeated tactical updates in the same area/time window should usually sit in 50-69 unless they create a clear new strategic state.

EVIDENCE WEIGHTING (SOFT):
- No fixed ceilings; use judgment with consistency.
- Weigh source quality and diversity more than rhetorical intensity.
- Lower confidence and one-sided reporting should reduce score ambition.
- Reserve 85+ for events with strong corroboration or clearly verifiable formal state actions.

OUTPUT ONLY one fenced \`\`\`json code block:
\`\`\`json
{
  "scores": [
    { "eventId": "exact id", "importance": 0-100, "reason": "short reason" }
  ],
  "reasoning": "brief batch-level rationale"
}
\`\`\`

REQUIREMENTS:
- Include every eventId from CURRENT BATCH exactly once.
- importance must be integer 0-100.
- Do not include events outside CURRENT BATCH.
`;

function tryParseImpactRescoreJson(raw: string): ImpactRescoreResult | null {
    const jsonCandidate = extractJsonPayload(raw) ?? raw.trim();

    const attempts = [
        normalizeJsonCandidate(jsonCandidate),
        normalizeJsonCandidate(jsonCandidate)
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
            .replace(/,\s*([\]\}])/g, "$1"),
    ];

    for (const attempt of attempts) {
        try {
            const parsed = JSON.parse(attempt) as ImpactRescoreResult;
            if (parsed && Array.isArray(parsed.scores)) {
                return parsed;
            }
        } catch {
            // Keep trying fallback parse variants.
        }
    }

    return null;
}

async function rescoreImpactBatch(
    batchEvents: ImpactRescoreEvent[],
    lookbackEvents: ImpactRescoreEvent[]
): Promise<ImpactRescoreResult | null> {
    const lookbackContext = lookbackEvents.length > 0
        ? lookbackEvents.map((event) =>
            `- [${event.date}${event.timeOfDay ? ` ${event.timeOfDay}` : ""}] id:${event._id} | ${event.category} | status:${event.status} | imp:${event.importance}\n  ${event.title}`
        ).join("\n")
        : "(none)";

    const batchContext = batchEvents.map((event, index) => {
        const sourceSignals = [...(event.sources || [])]
            .sort((a, b) => b.credibility - a.credibility)
            .slice(0, 2)
            .map((source) => `${source.name}(${source.country},${source.credibility})`)
            .join(" | ") || "(none)";

        const sourceCountryCount = new Set((event.sources || []).map((source) => source.country)).size;
        const sourceCount = (event.sources || []).length;

        return (
            `${index + 1}. id:${event._id}\n` +
            `   Date: ${event.date}${event.timeOfDay ? ` ${event.timeOfDay}` : ""}\n` +
            `   Category: ${event.category} | Status: ${event.status} | Current importance: ${event.importance}\n` +
            `   Source coverage: ${sourceCount} sources across ${sourceCountryCount} country groups\n` +
            `   Source signals: ${sourceSignals}\n` +
            `   Title: ${event.title}\n` +
            `   Description: ${event.description}`
        );
    }
    ).join("\n\n");

    const prompt = `${IMPACT_RESCORE_PROMPT}

LOOKBACK CONTEXT (already rescored, chronological):
${lookbackContext}

CURRENT BATCH (${batchEvents.length} events):
${batchContext}

Return rescored importance for every event in CURRENT BATCH.`;

    const maxRetries = 2;
    let currentPrompt = prompt;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`🎚️ [IMPACT-RESCORE] Attempt ${attempt}/${maxRetries} for ${batchEvents.length} events...`);

        try {
            const response = await callGeminiStudio(currentPrompt, {
                thinkingLevel: GEMINI_THINKING.impactRescore,
            });

            const parsed = tryParseImpactRescoreJson(response);
            if (parsed && Array.isArray(parsed.scores)) {
                return parsed;
            }

            if (attempt < maxRetries) {
                currentPrompt = `${prompt}\n\nYour previous response was invalid. Re-output now as ONLY one fenced \`\`\`json code block. Include every eventId from CURRENT BATCH exactly once.`;
            }
        } catch (error) {
            console.log(`❌ [IMPACT-RESCORE] Attempt ${attempt} failed: ${error}`);
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                currentPrompt = prompt;
            }
        }
    }

    return null;
}

export const previewTimelineImpactRescoreBatch = internalAction({
    args: {
        batchSize: v.optional(v.number()),
        startIndex: v.optional(v.number()),
        includeProcessed: v.optional(v.boolean()),
        lookbackSize: v.optional(v.number()),
    },
    handler: async (ctx, args): Promise<{
        success: boolean;
        error?: string;
        meta?: {
            totalEventsInDb: number;
            candidateEvents: number;
            includeProcessed: boolean;
            startIndex: number;
            batchSize: number;
            lookbackSize: number;
            thinkingLevel: "medium";
        };
        summary?: {
            total: number;
            avgOldImportance: number;
            avgNewImportance: number;
            movedUp: number;
            movedDown: number;
            unchanged: number;
            crossedToKey70: number;
            crossedFromKey70: number;
        };
        events?: Array<{
            eventId: Id<"timelineEvents">;
            date: string;
            timeOfDay?: string;
            category: "military" | "diplomatic" | "humanitarian" | "political";
            status: "confirmed" | "disputed" | "debunked";
            title: string;
            description: string;
            oldImportance: number;
            newImportance: number;
            delta: number;
            reason?: string;
            sourceSignals: string[];
        }>;
        modelReasoning?: string;
    }> => {
        const allTimeline = await ctx.runQuery(internal.api.getAllTimelineEvents, {}) as ImpactRescoreEvent[];

        if (allTimeline.length === 0) {
            return { success: false, error: "No timeline events found" };
        }

        const includeProcessed = args.includeProcessed ?? false;
        const candidates = includeProcessed
            ? [...allTimeline]
            : allTimeline.filter((event) => event.impactRescoreProcessed !== true);

        if (candidates.length === 0) {
            return {
                success: false,
                error: "No candidate events found. If all are already processed, run resetTimelineImpactRescore first.",
            };
        }

        candidates.sort((a, b) => {
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            const timeA = a.timeOfDay || "99:99";
            const timeB = b.timeOfDay || "99:99";
            if (timeA !== timeB) return timeA.localeCompare(timeB);
            return (a.createdAt || 0) - (b.createdAt || 0);
        });

        const startIndex = Math.max(0, Math.min(args.startIndex ?? 0, Math.max(0, candidates.length - 1)));
        const batchSize = Math.max(5, Math.min(args.batchSize ?? 20, 80));
        const lookbackSize = Math.max(0, Math.min(args.lookbackSize ?? 15, 50));

        const batchEvents = candidates.slice(startIndex, startIndex + batchSize);
        const lookbackStart = Math.max(0, startIndex - lookbackSize);
        const lookbackEvents = candidates.slice(lookbackStart, startIndex);

        if (batchEvents.length === 0) {
            return { success: false, error: "No events in selected batch range" };
        }

        const modelResult = await rescoreImpactBatch(batchEvents, lookbackEvents);
        if (!modelResult || !Array.isArray(modelResult.scores)) {
            return { success: false, error: "Model failed to produce valid preview scores" };
        }

        const decisions = new Map<string, ImpactRescoreDecision>();
        for (const score of modelResult.scores) {
            const key = String(score.eventId || "").trim();
            if (!key) continue;
            decisions.set(key, {
                eventId: key,
                importance: Math.max(0, Math.min(100, Math.round(score.importance))),
                reason: score.reason,
            });
        }

        const previewEvents = batchEvents.map((event) => {
            const key = String(event._id);
            const decision = decisions.get(key);
            const newImportance = decision ? decision.importance : event.importance;
            return {
                eventId: event._id,
                date: event.date,
                timeOfDay: event.timeOfDay,
                category: event.category,
                status: event.status,
                title: event.title,
                description: event.description,
                oldImportance: event.importance,
                newImportance,
                delta: newImportance - event.importance,
                reason: decision?.reason,
                sourceSignals: [...(event.sources || [])]
                    .sort((a, b) => b.credibility - a.credibility)
                    .slice(0, 3)
                    .map((source) => `${source.name} (${source.country}, ${source.credibility})`),
            };
        });

        const total = previewEvents.length;
        const movedUp = previewEvents.filter((event) => event.delta > 0).length;
        const movedDown = previewEvents.filter((event) => event.delta < 0).length;
        const unchanged = total - movedUp - movedDown;
        const crossedToKey70 = previewEvents.filter((event) => event.oldImportance < 70 && event.newImportance >= 70).length;
        const crossedFromKey70 = previewEvents.filter((event) => event.oldImportance >= 70 && event.newImportance < 70).length;

        const avgOldImportance = Math.round(
            previewEvents.reduce((sum, event) => sum + event.oldImportance, 0) / total
        );
        const avgNewImportance = Math.round(
            previewEvents.reduce((sum, event) => sum + event.newImportance, 0) / total
        );

        return {
            success: true,
            meta: {
                totalEventsInDb: allTimeline.length,
                candidateEvents: candidates.length,
                includeProcessed,
                startIndex,
                batchSize: batchEvents.length,
                lookbackSize,
                thinkingLevel: "medium",
            },
            summary: {
                total,
                avgOldImportance,
                avgNewImportance,
                movedUp,
                movedDown,
                unchanged,
                crossedToKey70,
                crossedFromKey70,
            },
            events: previewEvents,
            modelReasoning: modelResult.reasoning ?? modelResult.summary,
        };
    },
});

export const startTimelineImpactRescore = internalAction({
    args: {
        batchSize: v.optional(v.number()),
        autoStart: v.optional(v.boolean()),
    },
    handler: async (ctx, args): Promise<{
        started: boolean;
        runId?: string;
        totalEvents?: number;
        batchSize?: number;
        estimatedTokensPerEvent?: number;
        eventsPer100kPrompt?: number;
        reason?: string;
        activeRunId?: string;
        totalEventsInDatabase?: number;
        unprocessedEvents?: number;
    }> => {
        const runId = `impact-rescore-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const autoStart = args.autoStart ?? true;

        const allTimeline = await ctx.runQuery(internal.api.getAllTimelineEvents, {}) as ImpactRescoreEvent[];
        if (allTimeline.length === 0) {
            return { started: false, reason: "No timeline events found" };
        }

        const pendingTimeline = allTimeline.filter((event) => event.impactRescoreProcessed !== true);
        if (pendingTimeline.length === 0) {
            return {
                started: false,
                reason: "All timeline events are already impact-rescored. Run resetTimelineImpactRescore to reprocess all.",
                totalEventsInDatabase: allTimeline.length,
                unprocessedEvents: 0,
            };
        }

        pendingTimeline.sort((a, b) => {
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            const timeA = a.timeOfDay || "99:99";
            const timeB = b.timeOfDay || "99:99";
            if (timeA !== timeB) return timeA.localeCompare(timeB);
            return (a.createdAt || 0) - (b.createdAt || 0);
        });

        const snapshotEventIds = pendingTimeline.map((event) => event._id);

        const totalChars = pendingTimeline.reduce((sum: number, event) => {
            const compact = `[${event.date}${event.timeOfDay ? ` ${event.timeOfDay}` : ""}] ${event.category} imp:${event.importance}\nTITLE: ${event.title}\nDESC: ${event.description}\n`;
            return sum + compact.length;
        }, 0);

        const estimatedTokensPerEvent = Math.max(1, Math.round((totalChars / pendingTimeline.length) / 4));
        const eventsPer100kPrompt = Math.max(1, Math.floor(100000 / estimatedTokensPerEvent));

        const autoBatchSize = Math.max(20, Math.min(80, Math.floor((100000 * 0.65) / estimatedTokensPerEvent)));
        const normalizedBatchSize = Math.max(10, Math.min(args.batchSize ?? Math.min(60, autoBatchSize), 80));

        const lock = await ctx.runMutation(internal.api.acquireTimelineImpactRescoreLock, {
            runId,
            batchSize: normalizedBatchSize,
            totalEvents: pendingTimeline.length,
            snapshotEventIds,
            estimatedTokensPerEvent,
            eventsPer100kPrompt,
        });

        if (!lock.acquired) {
            return {
                started: false,
                reason: "Another impact rescore run is already active",
                activeRunId: lock.activeRunId,
            };
        }

        if (autoStart) {
            await ctx.scheduler.runAfter(0, internal.historian.runTimelineImpactRescoreBatch, { runId });
        }

        console.log(`🎚️ [IMPACT-RESCORE] Started run ${runId}`);
        console.log(`   Events queued: ${pendingTimeline.length}/${allTimeline.length}, batchSize: ${normalizedBatchSize}, estTokens/event: ~${estimatedTokensPerEvent}, estEvents/100k: ~${eventsPer100kPrompt}`);

        return {
            started: true,
            runId,
            totalEvents: pendingTimeline.length,
            batchSize: normalizedBatchSize,
            estimatedTokensPerEvent,
            eventsPer100kPrompt,
            totalEventsInDatabase: allTimeline.length,
            unprocessedEvents: pendingTimeline.length,
        };
    },
});

export const runTimelineImpactRescoreBatch = internalAction({
    args: {
        runId: v.string(),
        scheduleNext: v.optional(v.boolean()),
    },
    handler: async (ctx, args): Promise<{
        continued: boolean;
        done: boolean;
        processedInBatch?: number;
        processedTotal?: number;
        totalEvents?: number;
        error?: string;
    }> => {
        try {
            const scheduleNext = args.scheduleNext ?? true;
            const state = await ctx.runQuery(internal.api.getTimelineImpactRescoreState, {});
            if (!state || !state.isRunning || state.runId !== args.runId) {
                return { continued: false, done: false, error: "Run is not active" };
            }

            const snapshotIds = state.snapshotEventIds || [];
            const totalEvents = state.totalEvents || snapshotIds.length;
            const nextIndex = state.nextIndex || 0;
            const batchSize = state.batchSize || 40;

            if (snapshotIds.length === 0 || nextIndex >= totalEvents) {
                await ctx.runMutation(internal.api.completeTimelineImpactRescoreRun, {
                    runId: args.runId,
                    progress: `Completed 0/${totalEvents}`,
                    });
                return { continued: false, done: true, processedTotal: totalEvents, totalEvents };
            }

            const batchIds = snapshotIds.slice(nextIndex, nextIndex + batchSize);
            const lookbackStart = Math.max(0, nextIndex - 15);
            const lookbackIds = snapshotIds.slice(lookbackStart, nextIndex);

            const [batchEventsRaw, lookbackEventsRaw] = await Promise.all([
                ctx.runQuery(internal.api.getTimelineEventsByIds, { eventIds: batchIds }),
                ctx.runQuery(internal.api.getTimelineEventsByIds, { eventIds: lookbackIds }),
            ]);

            const batchEvents: ImpactRescoreEvent[] = (batchEventsRaw as ImpactRescoreEvent[]).map((event) => ({
                _id: event._id,
                date: event.date,
                timeOfDay: event.timeOfDay,
                title: event.title,
                description: event.description,
                category: event.category,
                importance: event.importance,
                status: event.status,
                createdAt: event.createdAt,
                impactRescoreProcessed: event.impactRescoreProcessed,
                sources: event.sources?.map((source) => ({
                    name: source.name,
                    country: source.country,
                    credibility: source.credibility,
                })),
            }));

            const lookbackEvents: ImpactRescoreEvent[] = (lookbackEventsRaw as ImpactRescoreEvent[]).map((event) => ({
                _id: event._id,
                date: event.date,
                timeOfDay: event.timeOfDay,
                title: event.title,
                description: event.description,
                category: event.category,
                importance: event.importance,
                status: event.status,
                createdAt: event.createdAt,
                impactRescoreProcessed: event.impactRescoreProcessed,
            }));

            const modelResult = await rescoreImpactBatch(batchEvents, lookbackEvents);
            if (!modelResult || !Array.isArray(modelResult.scores)) {
                throw new Error("AI did not return valid impact scores");
            }

            const batchIdSet = new Set(batchEvents.map((event) => String(event._id)));
            const decisionById = new Map<string, ImpactRescoreDecision>();

            for (const decision of modelResult.scores) {
                const eventId = String(decision.eventId || "").trim();
                if (!eventId || !batchIdSet.has(eventId)) continue;
                const clamped = Math.max(0, Math.min(100, Math.round(decision.importance)));
                decisionById.set(eventId, {
                    eventId,
                    importance: clamped,
                    reason: decision.reason,
                    });
            }

            let missingScores = 0;
            const updates = batchEvents.map((event) => {
                const key = String(event._id);
                const decision = decisionById.get(key);
                if (!decision) missingScores++;
                return {
                    eventId: event._id,
                    importance: decision ? decision.importance : event.importance,
                };
            });

            const bulkResult = await ctx.runMutation(internal.api.bulkUpdateTimelineImportance, {
                runId: args.runId,
                updates,
            });

            const processedTotal = Math.min(totalEvents, nextIndex + batchIds.length);
            const totalBatches = Math.max(1, Math.ceil(totalEvents / batchSize));
            const completedBatchNumber = Math.ceil(processedTotal / batchSize);
            const progress = `batch ${completedBatchNumber}/${totalBatches} (${processedTotal}/${totalEvents})`;

            await ctx.runMutation(internal.api.updateTimelineImpactRescoreProgress, {
                runId: args.runId,
                processedEvents: processedTotal,
                nextIndex: processedTotal,
                updatedEvents: (state.updatedEvents || 0) + (bulkResult.updated || 0),
                failedEvents: (state.failedEvents || 0) + missingScores + Math.max(0, batchIds.length - batchEvents.length),
                progress,
            });

            if (processedTotal >= totalEvents) {
                await ctx.runMutation(internal.api.completeTimelineImpactRescoreRun, {
                    runId: args.runId,
                    progress: `Completed ${processedTotal}/${totalEvents}`,
                    });
                console.log(`✅ [IMPACT-RESCORE] Run ${args.runId} complete (${processedTotal}/${totalEvents})`);
                return {
                    continued: false,
                    done: true,
                    processedInBatch: batchEvents.length,
                    processedTotal,
                    totalEvents,
                };
            }

            if (scheduleNext) {
                await ctx.scheduler.runAfter(0, internal.historian.runTimelineImpactRescoreBatch, {
                    runId: args.runId,
                    });
            }

            return {
                continued: true,
                done: false,
                processedInBatch: batchEvents.length,
                processedTotal,
                totalEvents,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`❌ [IMPACT-RESCORE] Batch failed for run ${args.runId}: ${message}`);

            await ctx.runMutation(internal.api.failTimelineImpactRescoreRun, {
                runId: args.runId,
                error: message,
            });

            return { continued: false, done: true, error: message };
        }
    },
});

// =============================================================================
// TIMELINE CANONICALIZATION (ONE-TIME REFACTOR)
// AI-driven merge-only pass across existing timeline events
// =============================================================================

type CanonicalizationAction = {
    action: "no_action" | "merge_events";
    eventId?: string;
    sourceEventId?: string;
    targetEventId?: string;
    reasoning?: string;
    confidence?: "low" | "medium" | "high";
};

type CanonicalizationResult = {
    analysis?: string;
    reasoning?: string;
    actions: CanonicalizationAction[];
};

const CANONICALIZATION_PROMPT = `You are the HISTORIAN performing a timeline canonicalization pass.

GOAL:
- Keep timeline coherent, non-redundant, and historically accurate.
- Do NOT force changes. If an event is already good, return no_action.

OPERATING STANCE:
- Neutral and evidence-first.
- Prefer conservative edits over aggressive rewriting.
- Use no_action whenever uncertain.

ACTIONS:
- no_action: event is already good and should remain as-is.
- merge_events: sourceEventId is duplicate/redundant and should be merged into targetEventId (target survives).
- If an event needs wording/translation refinement but is not a duplicate, use no_action.
- If merge is uncertain, use no_action.

CANONICALIZATION PRINCIPLES:
1) One canonical event per same incident window (same actors/place/time with no material new state).
2) Keep distinct events separate if they represent different state changes.
3) Follow-up confirmations of the same milestone are usually supporting, not separate key events.
4) Avoid duplicate titles for the same date/time incident.
5) If current scoring already fits narrative importance, do not change it.

OUTPUT ONLY one fenced \`\`\`json code block:
\`\`\`json
{
  "analysis": "brief",
  "reasoning": "batch rationale",
  "actions": [
    {
      "action": "no_action|merge_events",
      "eventId": "for no_action",
      "sourceEventId": "for merge",
      "targetEventId": "for merge",
      "reasoning": "why",
      "confidence": "low|medium|high"
    }
  ]
}
\`\`\`

REQUIREMENTS:
- Every event in CURRENT BATCH must appear once in actions (usually as no_action unless change is needed).
- Use event IDs exactly as provided.
- Prefer no_action over speculative edits.
`;

function tryParseCanonicalizationJson(raw: string): CanonicalizationResult | null {
    const jsonCandidate = extractJsonPayload(raw) ?? raw.trim();

    const attempts = [
        normalizeJsonCandidate(jsonCandidate),
        normalizeJsonCandidate(jsonCandidate)
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
            .replace(/,\s*([\]\}])/g, "$1"),
    ];

    for (const attempt of attempts) {
        try {
            const parsed = JSON.parse(attempt) as CanonicalizationResult;
            if (parsed && Array.isArray(parsed.actions)) {
                return parsed;
            }
        } catch {
            // Try next parse variant.
        }
    }

    return null;
}

async function runCanonicalizationAiBatch(events: ImpactRescoreEvent[]): Promise<CanonicalizationResult | null> {
    const eventContext = events.map((event, index) => {
        const topSources = [...(event.sources || [])]
            .sort((a, b) => b.credibility - a.credibility)
            .slice(0, 3)
            .map((source) => `${source.name}(${source.country},${source.credibility})`)
            .join(" | ") || "(none)";

        return `${index + 1}. id:${String(event._id)}\n` +
            `   Date: ${event.date}${event.timeOfDay ? ` ${event.timeOfDay}` : ""}\n` +
            `   Category: ${event.category} | Status: ${event.status} | Importance: ${event.importance}\n` +
            `   Title: ${event.title}\n` +
            `   Description: ${event.description}\n` +
            `   Sources: ${topSources}`;
    }).join("\n\n");

    const prompt = `${CANONICALIZATION_PROMPT}

CURRENT BATCH (${events.length} events):
${eventContext}`;

    const maxRetries = 2;
    let currentPrompt = prompt;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`🧹 [CANONICALIZE] Attempt ${attempt}/${maxRetries} for ${events.length} events...`);
        try {
            const response = await callGeminiStudio(currentPrompt, {
                thinkingLevel: GEMINI_THINKING.canonicalization,
            });

            const parsed = tryParseCanonicalizationJson(response);
            if (parsed && Array.isArray(parsed.actions)) {
                return parsed;
            }

            if (attempt < maxRetries) {
                currentPrompt = `${prompt}\n\nYour previous output was invalid. Re-output valid JSON as ONLY one fenced \`\`\`json code block with one action per event id.`;
            }
        } catch (error) {
            console.log(`❌ [CANONICALIZE] Attempt ${attempt} failed: ${error}`);
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                currentPrompt = prompt;
            }
        }
    }

    return null;
}

export const startTimelineCanonicalization = internalAction({
    args: {
        batchSize: v.optional(v.number()),
        dryRunOnly: v.optional(v.boolean()),
        runRescoreAfter: v.optional(v.boolean()),
        rescoreBatchSize: v.optional(v.number()),
        autoStart: v.optional(v.boolean()),
        backupId: v.optional(v.id("timelineEventBackups")),
    },
    handler: async (ctx, args): Promise<{
        started: boolean;
        runId?: string;
        totalEvents?: number;
        batchSize?: number;
        dryRunOnly?: boolean;
        reason?: string;
        activeRunId?: string;
    }> => {
        const runId = `timeline-canonicalize-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const autoStart = args.autoStart ?? true;
        const dryRunOnly = args.dryRunOnly ?? true;
        const runRescoreAfter = args.runRescoreAfter ?? true;
        const rescoreBatchSize = Math.max(20, Math.min(args.rescoreBatchSize ?? 60, 120));
        const normalizedBatchSize = Math.max(20, Math.min(args.batchSize ?? 80, 150));

        if (!dryRunOnly && !args.backupId) {
            return {
                started: false,
                reason: "Applying canonicalization requires a backupId for rollback safety",
            };
        }

        const allTimeline = await ctx.runQuery(internal.api.getAllTimelineEvents, {}) as ImpactRescoreEvent[];
        if (allTimeline.length === 0) {
            return { started: false, reason: "No timeline events found" };
        }

        allTimeline.sort((a, b) => {
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            const timeA = a.timeOfDay || "99:99";
            const timeB = b.timeOfDay || "99:99";
            if (timeA !== timeB) return timeA.localeCompare(timeB);
            return (a.createdAt || 0) - (b.createdAt || 0);
        });

        const snapshotEventIds = allTimeline.map((event) => event._id);

        const lock = await ctx.runMutation(internal.api.acquireTimelineCanonicalizationLock, {
            runId,
            batchSize: normalizedBatchSize,
            totalEvents: allTimeline.length,
            dryRunOnly,
            runRescoreAfter,
            rescoreBatchSize,
            snapshotEventIds,
            backupId: args.backupId,
        });

        if (!lock.acquired) {
            return {
                started: false,
                reason: "Another canonicalization run is already active",
                activeRunId: lock.activeRunId,
            };
        }

        if (autoStart) {
            await ctx.scheduler.runAfter(0, internal.historian.runTimelineCanonicalizationBatch, {
                runId,
                applyChanges: !dryRunOnly,
                scheduleNext: true,
            });
        }

        return {
            started: true,
            runId,
            totalEvents: allTimeline.length,
            batchSize: normalizedBatchSize,
            dryRunOnly,
        };
    },
});

export const runTimelineCanonicalizationBatch = internalAction({
    args: {
        runId: v.string(),
        applyChanges: v.boolean(),
        scheduleNext: v.optional(v.boolean()),
    },
    handler: async (ctx, args): Promise<{
        continued: boolean;
        done: boolean;
        processedInBatch?: number;
        processedTotal?: number;
        totalEvents?: number;
        findingsInBatch?: number;
        updatesAppliedInBatch?: number;
        mergesAppliedInBatch?: number;
        deletesAppliedInBatch?: number;
        noActionInBatch?: number;
        actionPreview?: Array<{
            action: string;
            eventId?: string;
            sourceEventId?: string;
            targetEventId?: string;
            confidence?: string;
            reasoning?: string;
        }>;
        rescoreStarted?: {
            started: boolean;
            runId?: string;
            totalEvents?: number;
            batchSize?: number;
            estimatedTokensPerEvent?: number;
            eventsPer100kPrompt?: number;
            reason?: string;
            activeRunId?: string;
            totalEventsInDatabase?: number;
            unprocessedEvents?: number;
        };
        error?: string;
    }> => {
        try {
            const state = await ctx.runQuery(internal.api.getTimelineCanonicalizationState, {});
            if (!state || !state.isRunning || state.runId !== args.runId) {
                return { continued: false, done: false, error: "Run is not active" };
            }

            if (args.applyChanges && !state.dryRunOnly && !state.backupId) {
                throw new Error("Refusing to apply canonicalization without backupId");
            }

            const snapshotIds = state.snapshotEventIds || [];
            const totalEvents = state.totalEvents || snapshotIds.length;
            const nextIndex = state.nextIndex || 0;
            const batchSize = state.batchSize || 80;
            const scheduleNext = args.scheduleNext ?? true;

            if (snapshotIds.length === 0 || nextIndex >= totalEvents) {
                await ctx.runMutation(internal.api.completeTimelineCanonicalizationRun, {
                    runId: args.runId,
                    progress: `Completed ${nextIndex}/${totalEvents}`,
                    });
                return { continued: false, done: true, processedTotal: totalEvents, totalEvents };
            }

            const batchIds = snapshotIds.slice(nextIndex, nextIndex + batchSize);
            const batchEventsRaw = await ctx.runQuery(internal.api.getTimelineEventsByIds, { eventIds: batchIds });
            const batchEvents = (batchEventsRaw as ImpactRescoreEvent[]).map((event) => ({
                _id: event._id,
                date: event.date,
                timeOfDay: event.timeOfDay,
                title: event.title,
                description: event.description,
                category: event.category,
                importance: event.importance,
                status: event.status,
                createdAt: event.createdAt,
                sources: event.sources,
            }));

            const aiResult = await runCanonicalizationAiBatch(batchEvents);
            if (!aiResult || !Array.isArray(aiResult.actions)) {
                throw new Error("AI did not return valid canonicalization actions");
            }

            const batchIdSet = new Set(batchEvents.map((event) => String(event._id)));
            const actions: CanonicalizationAction[] = [];

            for (const action of aiResult.actions) {
                if (action.action !== "no_action" && action.action !== "merge_events") {
                    // Merge-only canonicalization mode.
                    continue;
                }

                if (action.action === "merge_events") {
                    const sourceId = String(action.sourceEventId || "").trim();
                    const targetId = String(action.targetEventId || "").trim();
                    if (!sourceId || !targetId) continue;
                    if (!batchIdSet.has(sourceId) || !batchIdSet.has(targetId)) continue;
                    actions.push(action);
                    continue;
                }

                const eventId = String(action.eventId || "").trim();
                if (!eventId || !batchIdSet.has(eventId)) continue;
                actions.push(action);
            }

            const actionPreview = actions
                .filter((action) => action.action !== "no_action")
                .slice(0, 30)
                .map((action) => ({
                    action: action.action,
                    eventId: action.eventId,
                    sourceEventId: action.sourceEventId,
                    targetEventId: action.targetEventId,
                    confidence: action.confidence,
                    reasoning: action.reasoning,
                }));

            const shouldApply = args.applyChanges && !state.dryRunOnly;
            const deletedIds = new Set<string>();
            let findingsInBatch = 0;
            const updatesAppliedInBatch = 0;
            let mergesAppliedInBatch = 0;
            const deletesAppliedInBatch = 0;
            let noActionInBatch = 0;

            for (const action of actions) {
                if (action.action === "no_action") {
                    noActionInBatch++;
                    continue;
                }

                findingsInBatch++;
                if (!shouldApply) continue;

                if (action.action === "merge_events") {
                    if (action.confidence !== "high") continue;
                    const sourceEventId = action.sourceEventId as Id<"timelineEvents"> | undefined;
                    const targetEventId = action.targetEventId as Id<"timelineEvents"> | undefined;
                    if (!sourceEventId || !targetEventId) continue;
                    if (deletedIds.has(String(sourceEventId)) || deletedIds.has(String(targetEventId))) continue;

                    const merged = await ctx.runMutation(internal.api.mergeTimelineEventsById, {
                        sourceEventId,
                        targetEventId,
                        reason: action.reasoning || "Canonicalization merge",
                        });

                    if (merged.merged) {
                        mergesAppliedInBatch++;
                        deletedIds.add(String(sourceEventId));
                    }
                    continue;
                }

                // Merge-only mode: no update/delete branches.
            }

            const processedTotal = Math.min(totalEvents, nextIndex + batchIds.length);
            const totalBatches = Math.max(1, Math.ceil(totalEvents / batchSize));
            const completedBatchNumber = Math.ceil(processedTotal / batchSize);
            const progress = `batch ${completedBatchNumber}/${totalBatches} (${processedTotal}/${totalEvents})`;

            await ctx.runMutation(internal.api.updateTimelineCanonicalizationProgress, {
                runId: args.runId,
                processedEvents: processedTotal,
                nextIndex: processedTotal,
                findings: (state.findings || 0) + findingsInBatch,
                updatesApplied: (state.updatesApplied || 0) + updatesAppliedInBatch,
                mergesApplied: (state.mergesApplied || 0) + mergesAppliedInBatch,
                deletesApplied: (state.deletesApplied || 0) + deletesAppliedInBatch,
                noActionCount: (state.noActionCount || 0) + noActionInBatch,
                progress,
            });

            if (processedTotal >= totalEvents) {
                let rescoreStarted: {
                    started: boolean;
                    runId?: string;
                    totalEvents?: number;
                    batchSize?: number;
                    estimatedTokensPerEvent?: number;
                    eventsPer100kPrompt?: number;
                    reason?: string;
                    activeRunId?: string;
                    totalEventsInDatabase?: number;
                    unprocessedEvents?: number;
                } | undefined;

                if (args.applyChanges && !state.dryRunOnly && state.runRescoreAfter) {
                    await ctx.runMutation(internal.api.cancelTimelineImpactRescoreRun, {
                        reason: "Preparing post-canonicalization rescore",
                        });
                    await Promise.all([
                        ctx.runMutation(internal.api.clearTimelineImpactRescoreFlags, {}),
                        ctx.runMutation(internal.api.resetTimelineImpactRescoreState, {}),
                    ]);

                    rescoreStarted = await ctx.runAction(internal.historian.startTimelineImpactRescore, {
                        batchSize: state.rescoreBatchSize,
                        });
                }

                await ctx.runMutation(internal.api.completeTimelineCanonicalizationRun, {
                    runId: args.runId,
                    progress: `Completed ${processedTotal}/${totalEvents}`,
                    });

                return {
                    continued: false,
                    done: true,
                    processedInBatch: batchEvents.length,
                    processedTotal,
                    totalEvents,
                    findingsInBatch,
                    updatesAppliedInBatch,
                    mergesAppliedInBatch,
                    deletesAppliedInBatch,
                    noActionInBatch,
                    actionPreview,
                    rescoreStarted,
                };
            }

            if (scheduleNext) {
                await ctx.scheduler.runAfter(0, internal.historian.runTimelineCanonicalizationBatch, {
                    runId: args.runId,
                    applyChanges: args.applyChanges,
                    scheduleNext,
                    });
            }

            return {
                continued: true,
                done: false,
                processedInBatch: batchEvents.length,
                processedTotal,
                totalEvents,
                findingsInBatch,
                updatesAppliedInBatch,
                mergesAppliedInBatch,
                deletesAppliedInBatch,
                noActionInBatch,
                actionPreview,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await ctx.runMutation(internal.api.failTimelineCanonicalizationRun, {
                runId: args.runId,
                error: message,
            });
            return { continued: false, done: true, error: message };
        }
    },
});

// =============================================================================
// LEGACY TIMELINE CLEANUP ACTION
// Deprecated to prevent accidental update/delete flows.
// Use runTimelineCanonicalizationLoop / startTimelineCanonicalizationAsync.
// =============================================================================

export const runTimelineCleanup = internalAction({
    args: {
        date: v.optional(v.string()),
        startDate: v.optional(v.string()),
        endDate: v.optional(v.string()),
    },
    handler: async (): Promise<{
        eventsUpdated: number;
        eventsDeleted: number;
        summary: string;
    }> => {
        return {
            eventsUpdated: 0,
            eventsDeleted: 0,
            summary: "Deprecated: use timeline canonicalization loop (merge-only with backup safety).",
        };
    },
});

// Admin-only, resumable repair for legacy Thai/Khmer timeline fields. Each
// invocation repairs one bounded batch and refuses all writes unless every
// requested field in that batch passes the same deterministic validator used
// by normal persistence paths. The caller must supply a full-timeline backup
// ID so every write carries its rollback reference in the audit reason.
export const repairLegacyTimelineLocalizations = internalAction({
    args: {
        backupId: v.string(),
        batchSize: v.optional(v.number()),
    },
    handler: async (ctx, args): Promise<{
        scannedEvents: number;
        remainingPairsBefore: number;
        repairedPairs: number;
        repairedFields: number;
        updatedEvents: number;
        done: boolean;
    }> => {
        const events: any[] = await ctx.runQuery(api.api.getTimeline, { limit: 1000 });
        const candidates: Array<{
            id: string;
            eventId: Id<"timelineEvents">;
            kind: "title" | "description";
            english: string;
            repair: Array<"th" | "kh">;
        }> = [];

        for (const event of events) {
            const pairs = [
                { kind: "title" as const, english: event.title, thai: event.titleTh, khmer: event.titleKh },
                { kind: "description" as const, english: event.description, thai: event.descriptionTh, khmer: event.descriptionKh },
            ];
            for (const pair of pairs) {
                if (typeof pair.english !== "string" || !pair.english.trim()) continue;
                const repair: Array<"th" | "kh"> = [];
                if (!isValidLocalizedText(pair.thai, "th")) repair.push("th");
                if (!isValidLocalizedText(pair.khmer, "kh")) repair.push("kh");
                if (repair.length === 0) continue;
                candidates.push({
                    id: `${event._id}:${pair.kind}`,
                    eventId: event._id,
                    kind: pair.kind,
                    english: pair.english,
                    repair,
                });
            }
        }

        const batchSize = Math.max(1, Math.min(30, Math.round(args.batchSize ?? 24)));
        const batch = candidates.slice(0, batchSize);
        if (batch.length === 0) {
            return {
                scannedEvents: events.length,
                remainingPairsBefore: 0,
                repairedPairs: 0,
                repairedFields: 0,
                updatedEvents: 0,
                done: true,
            };
        }

        const items: LocalizedRepairItem[] = batch.map(({ id, english, repair }) => ({ id, english, repair }));
        const repaired = await repairLocalizedItems(items, undefined, GEMINI_THINKING.historian);
        const updates = new Map<Id<"timelineEvents">, Record<string, string>>();
        let repairedFields = 0;

        for (const candidate of batch) {
            const fixed = repaired.get(candidate.id);
            if (!fixed) throw new Error(`Legacy localization repair missing result for ${candidate.id}`);
            const patch = updates.get(candidate.eventId) ?? {};

            if (candidate.repair.includes("th")) {
                if (!isValidLocalizedText(fixed.thai, "th")) {
                    throw new Error(`Legacy localization repair returned invalid Thai for ${candidate.id}`);
                }
                patch[candidate.kind === "title" ? "titleTh" : "descriptionTh"] = fixed.thai;
                repairedFields++;
            }
            if (candidate.repair.includes("kh")) {
                if (!isValidLocalizedText(fixed.khmer, "kh")) {
                    throw new Error(`Legacy localization repair returned invalid Khmer for ${candidate.id}`);
                }
                patch[candidate.kind === "title" ? "titleKh" : "descriptionKh"] = fixed.khmer;
                repairedFields++;
            }
            updates.set(candidate.eventId, patch);
        }

        await ctx.runMutation(internal.api.bulkUpdateTimelineLocalizations, {
            updates: [...updates].map(([eventId, patch]) => ({ eventId, ...patch })),
            reason: `Legacy multilingual repair; backup ${args.backupId}`,
        });

        return {
            scannedEvents: events.length,
            remainingPairsBefore: candidates.length,
            repairedPairs: batch.length,
            repairedFields,
            updatedEvents: updates.size,
            done: candidates.length <= batch.length,
        };
    },
});

