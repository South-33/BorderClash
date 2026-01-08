"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { MODELS } from "./config";
import { callGeminiStudio, formatTimelineEvent } from "./ai_utils";


// =============================================================================
// HISTORIAN PROMPT
// The "thinking" analyst that decides what becomes a timeline event
// =============================================================================

const HISTORIAN_PROMPT = `You are the HISTORIAN - the final gatekeeper of truth for BorderClash.

🧠 WHO YOU ARE:
You're not a news aggregator. You're building the historical record that people will reference years from now.
You've seen how propaganda works, how governments spin, how media sensationalizes.
Your job is to cut through all of it and record WHAT ACTUALLY HAPPENED.

You are skeptical of everyone equally. Thai claims, Cambodian claims, international media - all get the same scrutiny.
You don't take sides. You take notes.

⚡ HOW YOU THINK:
- VERIFY before you trust. Visit URLs. Search the web. Cross-reference.
- QUESTION everything. "Who benefits from this story?" "What's the evidence?" "Who else is reporting this?"
- ADMIT uncertainty. "Disputed" and "unverified" are valid states. Don't pretend to know what you don't.

💡 TIP: You have the [google_search] tool available. Use it to verify claims, find newer updates, or cross-reference facts when the provided articles or timeline are insufficient.

🎯 YOUR CORE PRINCIPLES:

1. HISTORICAL SIGNIFICANCE
   Ask: "Would someone researching this conflict in 10 years need to know this?"
   If yes → Timeline. If no → Archive.

2. SYMMETRIC SKEPTICISM  
   Government press releases from ANY country = claims, not facts.
   Cross-reference. Verify. Trust evidence, not authority.

3. NO DUPLICATES
   Before creating, check: "Is this already on the timeline?"
   Same event + different wording = MERGE, don't create.
   Same day + same place + related actions = CONSOLIDATE into one event.

4. CREDIBILITY IS YOUR JUDGMENT
   You rate every article 0-100 based on: evidence quality, source reliability, bias level, verification.
   Your rating overrides whatever credibility score came before.

5. EVENT vs REACTION (CRITICAL FILTER)
   Only EVENTS belong on the timeline. REACTIONS get archived.
   
   EVENT = Something physically happened
     ✅ Combat action (airstrikes, shelling, captures)
     ✅ Territorial change (forces advance/retreat)
     ✅ Treaty/agreement signed
     ✅ Major humanitarian milestone (100k+ displaced, hospitals overwhelmed)
     ✅ Confirmed casualties (discrete incident, not running totals)
   
   REACTION = Commentary, warnings, measurements about events
     ❌ Travel advisories from foreign governments → ARCHIVE
     ❌ Tourism/economic impact reports → ARCHIVE
     ❌ Celebrity/activist statements → ARCHIVE
     ❌ Running casualty total updates (unless major milestone) → ARCHIVE
     ❌ "Status quo" reports ("fighting continues", "ceasefire holds") → ARCHIVE
   
   If something is a REACTION to an event, archive it. The event itself is what matters.

📊 IMPORTANCE SCALE (0-100):
- 90-100: War-level events. Peace treaties. Mass casualties.
- 70-89: Major military action. Diplomatic breakthroughs.
- 50-69: Significant developments. Confirmed incidents.
- 30-49: Minor but real → ARCHIVE (too granular for main timeline)
- 0-29: Not timeline-worthy → ARCHIVE.

📅 DATES & TIMES:
- Published dates are often WRONG. Find the actual event date from the article.
- Estimate time of day when possible (dawn attacks, afternoon announcements, etc.)
- Cause must come before effect. Order events logically.
- Format: "YYYY-MM-DD" for date, "HH:MM" for time (24-hour).

🔄 TIMELINE CLEANUP:
You have FULL ACCESS to the entire timeline. You can:
- UPDATE old events with new information
- DELETE events that turned out to be false
- MERGE duplicates (update the better one, delete the worse)
- Change status: confirmed → disputed → debunked

If new evidence shows an old event was wrong, FIX IT. That's your job.

📋 YOUR ACTIONS:

| Action | When to Use |
|--------|-------------|
| create_event | New verified event worthy of permanent record |
| merge_source | Article confirms existing event - add as source |
| update_event | Correct/improve existing event (including merging duplicates) |
| delete_event | Remove fabricated events OR duplicates after merging |
| archive | True but not important enough for timeline |
| discard | Broken links, spam, gibberish |
| flag_conflict | Contradicts timeline, needs investigation |

🌐 LANGUAGE & TRANSLATION:
- Write for a GENERAL AUDIENCE. If a teenager wouldn't understand a word, use a simpler one.
- Thai/Khmer: Don't translate. RE-TELL the story as if you ARE a Thai/Cambodian person explaining the news to your friend over coffee. Use the words THEY would use, not dictionary equivalents.
- ALWAYS use English numerals (0-9) - NEVER Thai ๑๒๓ or Khmer ១២៣

📝 PROCESS:
1. List each article with your analysis plan FIRST
2. Then output JSON wrapped in <json> tags

FORMAT:
---
ARTICLE ANALYSIS:
1. [COUNTRY] "Title" → Action: X | Credibility: Y | Reasoning
2. [COUNTRY] "Title" → Action: X | Credibility: Y | Reasoning
---
<json>
{
  "actions": [
    {
      "articleTitle": "Exact title from input",
      "articleCountry": "thailand|cambodia|international",
      "action": "create_event|merge_source|update_event|archive|discard|flag_conflict|delete_event",
      "verifiedCredibility": 0-100,
      "credibilityReason": "Brief explanation",
      "visitedSourceUrl": true,
      "eventData": {
        "date": "YYYY-MM-DD",
        "timeOfDay": "HH:MM",
        "title": "English title (max 10 words)",
        "titleTh": "Thai translation",
        "titleKh": "Khmer translation",
        "description": "2-3 sentences",
        "descriptionTh": "Thai translation",
        "descriptionKh": "Khmer translation",
        "category": "military|diplomatic|humanitarian|political",
        "importance": 0-100,
        "sourceSnippet": "Key quote"
      },
      "targetEventTitle": "For merge/update/delete - exact title from timeline",
      "eventUpdates": { "field": "newValue" },
      "reasoning": "Why this action"
    }
  ],
  "summary": "Processed X: created Y, merged Z, archived W"
}
</json>

RULES:
- Every article MUST have an action
- create_event/merge_source/update_event require visitedSourceUrl: true
- update_event/delete_event require targetEventTitle + reasoning
- Output valid JSON only inside the tags
`;

// =============================================================================
// PLANNER PROMPT
// Phase 1: Sees ALL articles, picks up to 10 most important to process
// =============================================================================

const PLANNER_PROMPT = `You are the PLANNER for BorderClash's Timeline Historian system.
Your job is to look at ALL pending articles and pick UP TO 10 MOST IMPORTANT ones to process right now.

🎯 YOUR MISSION:
You have the [google_search] tool available - use it if you need more context before planning.
You will receive a list of ALL unprocessed news articles.
You must select 5-10 that are MOST worth processing based on:

1. IMPACT - Major events that will shape the conflict
2. URGENCY - Breaking news that needs immediate processing
3. CROSS-VALIDATION - Multiple articles about the same event (group them!)
4. GAPS - Events not yet covered in the timeline

📊 SELECTION CRITERIA:

✅ PRIORITIZE:
- Breaking news about active conflict
- Articles that confirm/contradict existing timeline events
- High-credibility sources (AP, Reuters, BBC, major national outlets)
- Multiple articles covering the same event (pick all of them together)
- Events with clear dates and verifiable details

❌ DE-PRIORITIZE (save for later):
- Opinion pieces and analysis (process facts first)
- Routine government statements
- Very old news (unless filling a timeline gap)

🔍 GROUPING:
If multiple articles cover the SAME EVENT, include ALL of them together.
This helps the Historian cross-validate and merge sources.

Example: If 3 articles all talk about "Dec 12 border clash", pick all 3.

OUTPUT FORMAT - Wrap your JSON in <json> tags:
<json>
{
  "selectedArticles": [
    "Exact title of article 1",
    "Exact title of article 2",
    "Exact title of article 3"
  ],
  "reasoning": "Brief explanation of why these 5-10 were chosen",
  "groupedEvents": [
    {
      "eventDescription": "Dec 12 border clash at Preah Vihear",
      "relatedArticles": ["Article 1 title", "Article 2 title"]
    }
  ]
}
</json>

RULES:
- Select 5-10 articles (no more, no less unless fewer are available)
- Use EXACT article titles from the input
- You can think before the <json> tags
`;

// =============================================================================
// PLANNER RUNNER
// Selects which articles to process from the full queue
// =============================================================================

async function runPlanner(
    allArticles: Array<{
        title: string;
        country: string;
        source: string;
        credibility: number;
        summary?: string;
    }>,
    existingTimeline: Array<{
        date: string;
        title: string;
        description: string;
        importance: number;
    }>
): Promise<string[] | null> {

    // Build compact article list (just enough info for selection)
    const articlesContext = allArticles.map((a, i) =>
        `${i + 1}. [${a.country.toUpperCase()}] "${a.title}" (${a.source}, cred:${a.credibility})`
    ).join("\n");

    // Build timeline context using shared helper
    const timelineContext = existingTimeline.length > 0
        ? existingTimeline.map((e: any) => formatTimelineEvent(e)).join("\n\n")
        : "(Timeline is empty)";

    const prompt = `${PLANNER_PROMPT}

═══════════════════════════════════════════════════════════════
📰 ALL PENDING ARTICLES (${allArticles.length} total):
${articlesContext}

📜 CURRENT TIMELINE (${existingTimeline.length} events):
${timelineContext}
═══════════════════════════════════════════════════════════════

Pick 5-10 articles to process now. Output your selection in JSON.`;

    console.log("🧠 [PLANNER] Analyzing all articles to pick best 5-10...");
    const response = await callGeminiStudio(prompt, MODELS.thinking, 2);

    // Helper to clean and parse JSON with multiple fallback strategies
    const tryParseJson = (jsonStr: string): any => {
        // Strategy 1: Direct parse
        try {
            return JSON.parse(jsonStr);
        } catch { /* continue */ }

        // Strategy 2: Remove control characters + trailing commas
        try {
            const cleaned = jsonStr
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
                .replace(/,\s*([\]\}])/g, '$1');
            return JSON.parse(cleaned);
        } catch { /* continue */ }

        // Strategy 3: Escape unescaped newlines inside strings
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

    // Extract JSON
    const tagMatch = response.match(/<json>([\s\S]*?)<\/json>/i);
    if (!tagMatch) {
        console.log("❌ [PLANNER] No JSON found in API response");
        console.log("ℹ️ [PLANNER] Will fall back to default article selection");
        return null;
    }

    const result = tryParseJson(tagMatch[1].trim());
    if (result && result.selectedArticles && Array.isArray(result.selectedArticles)) {
        console.log(`✅ [PLANNER] Selected ${result.selectedArticles.length} articles`);
        console.log(`   Reasoning: ${result.reasoning}`);
        return result.selectedArticles;
    }

    console.log("❌ [PLANNER] Invalid result structure or parse failed");
    console.log("ℹ️ [PLANNER] Will fall back to default article selection");
    return null;
}

// =============================================================================
// HISTORIAN RUNNER
// Processes a batch of articles against the timeline
// =============================================================================


interface HistorianAction {
    articleTitle: string;
    articleCountry: string;
    action: "create_event" | "merge_source" | "archive" | "discard" | "flag_conflict" | "update_event" | "delete_event";
    // CREDIBILITY VERIFICATION - Historian updates credibility for EVERY article
    verifiedCredibility?: number;  // 0-100, the Historian's assessed credibility after verification
    credibilityReason?: string;    // Brief explanation of why credibility was adjusted
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
    }>
): Promise<HistorianResult | null> {

    // Build article context with publication dates
    const articlesContext = articles.map((a, i) => {
        const pubDate = a.publishedAt ? new Date(a.publishedAt).toISOString().split('T')[0] : 'unknown';
        return `${i + 1}. [${a.country.toUpperCase()}] "${a.title}"
   Published: ${pubDate} | Source: ${a.source} | Credibility: ${a.credibility}/100
   URL: ${a.sourceUrl}
   Summary: ${a.summary || "(no summary)"}`;
    }).join("\n\n");

    // Build timeline context using shared helper
    const timelineContext = existingTimeline.length > 0
        ? existingTimeline.map((e: any) => formatTimelineEvent(e)).join("\n\n")
        : "(Timeline is empty)";

    const prompt = `${HISTORIAN_PROMPT}

═══════════════════════════════════════════════════════════════
📰 NEW ARTICLES TO PROCESS (${articles.length} articles):
${articlesContext}

📜 EXISTING TIMELINE (${existingTimeline.length} events):
${timelineContext}
═══════════════════════════════════════════════════════════════

Process each article above and decide its fate. Output your decisions in JSON.`;

    const response = await callGeminiStudio(prompt, MODELS.thinking, 2);

    // Helper to clean and parse JSON with multiple fallback strategies
    const tryParseJson = (jsonStr: string): HistorianResult | null => {
        // Strategy 1: Direct parse
        try {
            return JSON.parse(jsonStr);
        } catch { /* continue */ }

        // Strategy 2: Remove control characters + trailing commas
        try {
            const cleaned = jsonStr
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
                .replace(/,\s*([\]\}])/g, '$1');
            return JSON.parse(cleaned);
        } catch { /* continue */ }

        // Strategy 3: Escape unescaped newlines inside strings
        // This regex finds strings and replaces real newlines with \n
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

    // Extract JSON from response
    const tagMatch = response.match(/<json>([\s\S]*?)<\/json>/i);
    let jsonStr: string | null = null;

    if (tagMatch) {
        jsonStr = tagMatch[1].trim();
    } else {
        // Fallback: try to find raw JSON
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
        }
    }

    if (!jsonStr) {
        console.log("❌ [HISTORIAN] No JSON found in response");
        return null;
    }

    // Try to parse with all strategies
    const result = tryParseJson(jsonStr);
    if (result) {
        return result;
    }

    // Strategy 4: Ask AI to repair the broken JSON
    console.log("🔧 [HISTORIAN] JSON parse failed, asking AI to repair...");
    try {
        const repairPrompt = `The following JSON has syntax errors. Fix them and output ONLY valid JSON wrapped in <json> tags.

BROKEN JSON:
${jsonStr.substring(0, 3000)}${jsonStr.length > 3000 ? '...(truncated)' : ''}

Rules:
- Fix any unescaped characters in strings
- Fix trailing commas
- Fix unclosed brackets
- Output ONLY the fixed JSON in <json>...</json> tags`;

        const repairResponse = await callGeminiStudio(repairPrompt, MODELS.thinking, 1);
        const repairMatch = repairResponse.match(/<json>([\s\S]*?)<\/json>/i);

        if (repairMatch) {
            const repaired = tryParseJson(repairMatch[1].trim());
            if (repaired) {
                console.log("✅ [HISTORIAN] JSON repaired successfully by AI");
                return repaired;
            }
        }
    } catch (repairError) {
        console.log(`❌ [HISTORIAN] AI repair failed: ${repairError}`);
    }

    console.log("❌ [HISTORIAN] All JSON parse attempts failed");
    console.log("ℹ️ [HISTORIAN] No timeline changes will be made - existing events preserved");
    return null;
}

// =============================================================================
// MAIN HISTORIAN ACTION
// Two-phase approach: Planner picks, Historian processes
// =============================================================================

export const runHistorianCycle = internalAction({
    args: {},
    handler: async (ctx): Promise<{
        processed: number;
        eventsCreated: number;
        eventsUpdated?: number;
        eventsDeleted?: number;
        sourcesMerged?: number;
        archived: number;
        discarded?: number;
        credibilityUpdated?: number;
    }> => {
        console.log("═══════════════════════════════════════════════════════════════");
        console.log("📜 HISTORIAN CYCLE STARTED (Two-Phase)");
        console.log("═══════════════════════════════════════════════════════════════");

        // 1. Get ALL unprocessed articles (not just 10)
        const allArticles = await ctx.runQuery(internal.api.getUnprocessedForTimeline, {
            batchSize: 200,  // Get all of them
        });

        if (allArticles.length === 0) {
            console.log("✅ No unprocessed articles. Historian is idle.");
            return { processed: 0, eventsCreated: 0, archived: 0 };
        }

        console.log(`📰 Found ${allArticles.length} unprocessed articles total`);

        // 2. Get existing timeline for context
        // 300 events = ~30k tokens context, enough for duplicate detection and updates
        const timeline = await ctx.runQuery(internal.api.getRecentTimeline, {
            limit: 300  // Recent events for context (older events rarely updated)
        });
        console.log(`📜 Timeline context: ${timeline.length} recent events`);

        // 3. Get timeline stats
        const timelineStats = await ctx.runQuery(internal.api.getTimelineStats, {});
        console.log(`📊 Timeline stats: ${timelineStats.totalEvents} events, avg importance: ${timelineStats.avgImportance}`);

        // ====================================================================
        // PHASE 1: PLANNER - Pick up to 10 most important articles
        // ====================================================================
        console.log("\n🧠 [PHASE 1] PLANNER - Selecting best articles to process...");

        let selectedTitles: string[];

        if (allArticles.length <= 10) {
            // If 10 or fewer, process all
            console.log(`   Only ${allArticles.length} articles - processing all`);
            selectedTitles = allArticles.map((a: any) => a.title);
        } else {
            // Run Planner to pick 5-10
            const plannerSelection = await runPlanner(
                allArticles.map((a: any) => ({
                    title: a.title,
                    country: a.country,
                    source: a.source,
                    credibility: a.credibility,
                    summary: a.summary || a.summaryEn,
                })),
                timeline.map((t: any) => ({
                    date: t.date,
                    title: t.title,
                    description: t.description,
                    importance: t.importance,
                }))
            );

            if (!plannerSelection || plannerSelection.length === 0) {
                console.log("⚠️ Planner failed, falling back to first 10 by credibility");
                selectedTitles = allArticles.slice(0, 10).map((a: any) => a.title);
            } else {
                selectedTitles = plannerSelection;
            }
        }

        // Helper for fuzzy title matching (AI often returns slightly different titles)
        const normalizeTitle = (title: string) =>
            title.toLowerCase().trim()
                .replace(/[""'']/g, '"')  // Normalize quotes
                .replace(/\s+/g, ' ')      // Normalize whitespace
                .substring(0, 50);         // Compare first 50 chars

        // Filter to selected articles with FUZZY matching
        let selectedArticles = allArticles.filter((a: any) => {
            const normalizedDbTitle = normalizeTitle(a.title);
            return selectedTitles.some(plannerTitle => {
                const normalizedPlannerTitle = normalizeTitle(plannerTitle);
                // Exact match OR first 50 chars match OR one contains the other
                return normalizedDbTitle === normalizedPlannerTitle ||
                    normalizedDbTitle.includes(normalizedPlannerTitle) ||
                    normalizedPlannerTitle.includes(normalizedDbTitle);
            });
        });

        // If fuzzy matching found nothing, log what planner returned vs what we have
        if (selectedArticles.length === 0 && selectedTitles.length > 0) {
            console.log("⚠️ [PLANNER] No titles matched! Planner returned:");
            selectedTitles.slice(0, 3).forEach(t => console.log(`   → "${t.substring(0, 60)}..."`));
            console.log("   DB has titles like:");
            allArticles.slice(0, 3).forEach((a: any) => console.log(`   → "${a.title.substring(0, 60)}..."`));

            // Fallback: just use first 10 articles
            console.log("   → Falling back to first 10 articles by credibility");
            selectedArticles = allArticles.slice(0, 10);
        }

        console.log(`\n✅ [PHASE 1 COMPLETE] Selected ${selectedArticles.length} articles to process`);

        // ====================================================================
        // PHASE 2: HISTORIAN - Process the selected articles
        // ====================================================================
        console.log("\n📜 [PHASE 2] HISTORIAN - Processing selected articles...");

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
            console.log("❌ [HISTORIAN] No valid result from AI");
            console.log("ℹ️ [HISTORIAN] No timeline changes will be made - existing events preserved");
            return { processed: 0, eventsCreated: 0, eventsUpdated: 0, sourcesMerged: 0, archived: 0, discarded: 0 };
        }

        console.log(`🎯 Historian returned ${historianResult.actions.length} actions`);

        // 5. Execute actions
        let eventsCreated = 0;
        let eventsUpdated = 0;
        let eventsDeleted = 0;
        let sourcesMerged = 0;
        let archived = 0;
        let discarded = 0;
        let credibilityUpdated = 0;

        // Helper to decode HTML entities (AI sometimes returns &quot; instead of ")
        const decodeHtmlEntities = (str: string) => {
            return str
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&#39;/g, "'")
                .replace(/&apos;/g, "'");
        };

        for (const action of historianResult.actions) {
            // Decode HTML entities in the article title from AI response
            const searchTitle = decodeHtmlEntities(action.articleTitle);
            const article = selectedArticles.find((a: any) => a.title === searchTitle);
            if (!article) {
                console.log(`⚠️ Article not found: "${action.articleTitle}"`);
                continue;
            }

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
                        console.log(`📌 Created event: "${action.eventData.title}" (importance: ${action.eventData.importance})`);
                        eventsCreated++;
                    }
                    break;

                case "merge_source":
                    if (action.targetEventTitle) {
                        // Find the event to merge into
                        const matchingEvents = await ctx.runQuery(internal.api.findEventByTitleAndDate, {
                            title: action.targetEventTitle,
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
                            console.log(`➕ Merged source into: "${action.targetEventTitle}"`);
                            sourcesMerged++;
                        } else {
                            console.log(`⚠️ Target event not found: "${action.targetEventTitle}"`);
                        }
                    }
                    break;

                case "archive":
                    // Archive = mark as processed but not timeline-worthy
                    await ctx.runMutation(internal.api.flagArticle, {
                        country: article.country as "thailand" | "cambodia" | "international",
                        title: article.title,
                        status: "archived",
                    });
                    console.log(`📦 Archived: "${article.title}"`);
                    archived++;
                    break;

                case "discard":
                    // Discard = mark as false (bad data)
                    await ctx.runMutation(internal.api.flagArticle, {
                        country: article.country as "thailand" | "cambodia" | "international",
                        title: article.title,
                        status: "false",
                    });
                    console.log(`🗑️ Discarded: "${article.title}"`);
                    discarded++;
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
                        console.log(`✏️ Updated event: "${action.targetEventTitle}" - ${action.reasoning || "no reason given"}`);
                        eventsUpdated++;
                    } else {
                        console.log(`⚠️ update_event missing targetEventTitle or eventUpdates`);
                    }
                    break;

                case "flag_conflict":
                    // Mark for deeper investigation
                    await ctx.runMutation(internal.api.updateArticleValidation, {
                        country: article.country as "thailand" | "cambodia" | "international",
                        title: article.title,
                        hasConflict: true,
                        conflictsWith: action.targetEventTitle,
                    });
                    console.log(`⚠️ Flagged conflict: "${article.title}" vs "${action.targetEventTitle}"`);
                    break;

                case "delete_event":
                    // DELETE an existing timeline event - USE EXTREMELY RARELY
                    if (action.targetEventTitle && action.reasoning) {
                        await ctx.runMutation(internal.api.deleteTimelineEvent, {
                            eventTitle: action.targetEventTitle,
                            reason: action.reasoning,
                        });
                        console.log(`🗑️ DELETED event: "${action.targetEventTitle}" - Reason: ${action.reasoning}`);
                        eventsDeleted++;
                    } else {
                        console.log(`⚠️ delete_event missing targetEventTitle or reasoning`);
                    }
                    break;
            }

            // UPDATE CREDIBILITY - Historian verifies and adjusts credibility for every article
            if (action.verifiedCredibility !== undefined) {
                const oldCred = article.credibility || 50;
                const newCred = Math.max(0, Math.min(100, action.verifiedCredibility));
                const credDiff = newCred - oldCred;

                await ctx.runMutation(internal.api.updateArticleCredibility, {
                    country: article.country as "thailand" | "cambodia" | "international",
                    title: article.title,
                    credibility: newCred,
                });

                const arrow = credDiff > 0 ? "↑" : credDiff < 0 ? "↓" : "→";
                console.log(`   📊 Credibility: ${oldCred} ${arrow} ${newCred} | ${action.credibilityReason || ""}`);
                credibilityUpdated++;
            }

            // Mark article as processed by Historian (regardless of action taken)
            await ctx.runMutation(internal.api.markAsProcessedToTimeline, {
                country: article.country as "thailand" | "cambodia" | "international",
                title: article.title,
            });
        }

        // IMPORTANT: Also mark any selected articles that the AI forgot to include in its response
        // This prevents "orphaned" articles from being reprocessed forever
        // Decode HTML entities to match consistently with the action processing above
        const processedTitles = new Set(
            historianResult.actions.map((a: HistorianAction) => decodeHtmlEntities(a.articleTitle))
        );
        for (const article of selectedArticles) {
            if (!processedTitles.has(article.title)) {
                console.log(`⚠️ AI forgot to return action for "${article.title}" - marking as processed anyway`);
                await ctx.runMutation(internal.api.markAsProcessedToTimeline, {
                    country: article.country as "thailand" | "cambodia" | "international",
                    title: article.title,
                });
            }
        }

        console.log("\n═══════════════════════════════════════════════════════════════");
        console.log(`📜 HISTORIAN CYCLE COMPLETE`);
        console.log(`   Events created: ${eventsCreated}`);
        console.log(`   Events updated: ${eventsUpdated}`);
        console.log(`   Events deleted: ${eventsDeleted}`);
        console.log(`   Sources merged: ${sourcesMerged}`);
        console.log(`   Articles archived: ${archived}`);
        console.log(`   Articles discarded: ${discarded}`);
        console.log(`   Credibility updated: ${credibilityUpdated}`);
        console.log("═══════════════════════════════════════════════════════════════");

        return {
            processed: selectedArticles.length,  // Return actual selected count, not just AI response count
            eventsCreated,
            eventsUpdated,
            eventsDeleted,
            sourcesMerged,
            archived,
            discarded,
            credibilityUpdated,
        };
    },
});

// =============================================================================
// TIMELINE CLEANUP ACTION
// Dedicated action to review and merge/consolidate existing timeline events
// Can be called independently of new articles
// =============================================================================

const CLEANUP_PROMPT = `You are the HISTORIAN doing a timeline audit.

🧠 YOUR MINDSET:
You're reviewing the historical record. Your goal is a CLEAN, ACCURATE, READABLE timeline.
Be CONSERVATIVE on merges - if two events MIGHT be different, keep them separate.
But DO fix redundancy and confusing titles.

⚠️ KEY PRINCIPLE: Better to have 2 related events than accidentally merge distinct incidents.

🎯 WHAT TO FIX:

1. OBVIOUS DUPLICATES - SAME event, different wording (same date, location, actors, action)
   → MERGE: Keep the one with more detail/sources, delete the other

2. REDUNDANT UPDATES - Multiple events on same topic with slightly updated numbers
   → Keep the MOST COMPLETE/LATEST one, delete the partial updates
   → Example: "400k displaced" (10:30) + "405k displaced" (11:30) on SAME day = redundant
   → Keep the 11:30 one with higher number, delete the 10:30 partial update
   
3. CONFUSING TITLES - Titles that are misleading or could confuse readers
   → UPDATE the title to be clearer (don't change the facts, just the wording)
   → Example: If Dec 12 says "First civilian deaths" and Dec 14 also says "First civilian death"
   → Clarify: Dec 12 → "First Civilian Deaths (Evacuation-Related)", Dec 14 → "First Direct Combat Civilian Fatality"

4. WRONG INFO - Factual errors you're confident about → UPDATE

5. FALSE EVENTS - Things proven to not have happened → DELETE or mark DEBUNKED

6. MISSING TRANSLATIONS - Events without Thai/Khmer → UPDATE to add them

⛔ DO NOT MERGE - These are DIFFERENT events:
- Different dates (even if same topic)
- Different locations (even if same date)
- Different actors (Thai vs Cambodian)
- Attack vs Response (keep both - they tell a story)
- Similar but distinct incidents (2 shellings at 2 places = 2 events)

📋 YOUR ACTIONS:

| Action | When |
|--------|------|
| update_event | Fix errors, clarify titles, add translations, consolidate redundant info |
| delete_event | Remove duplicates/redundant updates (after merging info), or fabrications |
| no_action | Timeline looks good - nothing to fix |

🌐 TRANSLATIONS:
If updating, include Thai (titleTh, descriptionTh) and Khmer (titleKh, descriptionKh).
Translate the MEANING and INTENT, not literal word-for-word.
Understand the context first, then express the same idea naturally in the target language.
Style: CASUAL, CONVERSATIONAL - how a regular person explains it to a friend.
Always use English numerals (0-9), never Thai ๑๒๓ or Khmer ១២๣.

OUTPUT:
\`\`\`json
{
  "analysis": "What you found - duplicates, redundancies, confusing titles, etc.",
  "mergeActions": [
    {
      "action": "update_event|delete_event|no_action",
      "targetEventTitle": "Exact title from timeline",
      "eventUpdates": { "field": "newValue" },
      "reasoning": "Why this change"
    }
  ],
  "summary": "What you did"
}
\`\`\`

RULES:
- It's OK to return empty mergeActions if timeline is clean
- For redundant updates: UPDATE the better one first, then DELETE the partial one
- Provide clear reasoning for every action
`;

interface CleanupAction {
    action: "update_event" | "delete_event" | "no_action";
    targetEventTitle: string;
    eventUpdates?: {
        title?: string;
        titleTh?: string;
        titleKh?: string;
        description?: string;
        descriptionTh?: string;
        descriptionKh?: string;
        importance?: number;
        timeOfDay?: string;
    };
    reasoning: string;
}

interface CleanupResult {
    analysis: string;
    mergeActions: CleanupAction[];
    summary: string;
}

export const runTimelineCleanup = internalAction({
    args: {
        date: v.optional(v.string()),  // Single date: "2025-12-12"
        startDate: v.optional(v.string()),  // Range start: "2025-12-11"
        endDate: v.optional(v.string()),    // Range end: "2025-12-12"
    },
    handler: async (ctx, args): Promise<{
        eventsUpdated: number;
        eventsDeleted: number;
        summary: string;
    }> => {
        console.log("═══════════════════════════════════════════════════════════════");
        console.log("🧹 TIMELINE CLEANUP STARTED");
        console.log("═══════════════════════════════════════════════════════════════");

        // Get existing timeline with full details
        // 300 events sufficient for finding recent duplicates
        const allTimeline = await ctx.runQuery(internal.api.getRecentTimeline, {
            limit: 300  // Recent events for cleanup
        });

        // Filter by date or date range if provided
        let timeline = allTimeline;

        if (args.date) {
            // Single date filter
            timeline = allTimeline.filter((e: any) => e.date === args.date);
            console.log(`📅 Filtering to date: ${args.date} `);
            console.log(`   Found ${timeline.length} events on this date(out of ${allTimeline.length} total)`);
        } else if (args.startDate && args.endDate) {
            // Date range filter
            timeline = allTimeline.filter((e: any) => e.date >= args.startDate! && e.date <= args.endDate!);
            console.log(`📅 Filtering to range: ${args.startDate} to ${args.endDate} `);
            console.log(`   Found ${timeline.length} events in range(out of ${allTimeline.length} total)`);
        } else if (args.startDate) {
            // From start date onwards
            timeline = allTimeline.filter((e: any) => e.date >= args.startDate!);
            console.log(`📅 Filtering from: ${args.startDate} onwards`);
            console.log(`   Found ${timeline.length} events(out of ${allTimeline.length} total)`);
        } else if (args.endDate) {
            // Up to end date
            timeline = allTimeline.filter((e: any) => e.date <= args.endDate!);
            console.log(`📅 Filtering up to: ${args.endDate} `);
            console.log(`   Found ${timeline.length} events(out of ${allTimeline.length} total)`);
        }

        console.log(`📜 Reviewing ${timeline.length} timeline events for merges...`);

        // Build timeline context using shared helper (with numbered index)
        const timelineContext = timeline.map((e: any, idx: number) => formatTimelineEvent(e, idx)).join("\n\n");

        const prompt = `${CLEANUP_PROMPT}

═══════════════════════════════════════════════════════════════
📜 CURRENT TIMELINE(${timeline.length} events):
${timelineContext}
═══════════════════════════════════════════════════════════════

Find duplicate or related events that should be merged.Output JSON with your merge actions.`;

        const response = await callGeminiStudio(prompt, MODELS.thinking, 2);

        // Extract JSON
        const jsonMatch = response.match(/```json\s * ([\s\S] *?) \s * ```/i) ||
            response.match(/\{[\s\S]*"mergeActions"[\s\S]*\}/);

        if (!jsonMatch) {
            console.log("❌ [CLEANUP] No JSON found in API response");
            console.log("ℹ️ [CLEANUP] No changes will be made - existing timeline preserved");
            return { eventsUpdated: 0, eventsDeleted: 0, summary: "AI returned no actions" };
        }

        let result: CleanupResult;
        try {
            const jsonStr = jsonMatch[1] || jsonMatch[0];
            result = JSON.parse(jsonStr.trim());
        } catch (e) {
            console.log(`❌[CLEANUP] JSON parse error: ${e} `);
            console.log("ℹ️ [CLEANUP] No changes will be made - existing timeline preserved");
            return { eventsUpdated: 0, eventsDeleted: 0, summary: "Failed to parse AI response" };
        }

        console.log(`📊 AI Analysis: ${result.analysis} `);
        console.log(`🎯 Found ${result.mergeActions?.length || 0} merge actions`);

        let eventsUpdated = 0;
        let eventsDeleted = 0;

        // Execute merge actions
        for (const action of result.mergeActions || []) {
            if (action.action === "no_action") continue;

            if (action.action === "update_event" && action.eventUpdates) {
                // Only allow valid fields - filter out anything the AI added that isn't in the validator
                const validFields = ['title', 'titleTh', 'titleKh', 'description', 'descriptionTh', 'descriptionKh', 'date', 'timeOfDay', 'category', 'importance', 'status'];
                const updates: any = {};
                for (const field of validFields) {
                    if ((action.eventUpdates as any)[field] !== undefined) {
                        updates[field] = (action.eventUpdates as any)[field];
                    }
                }

                if (Object.keys(updates).length === 0) {
                    console.log(`⚠️ No valid updates for: "${action.targetEventTitle}"`);
                    continue;
                }

                await ctx.runMutation(internal.api.updateTimelineEvent, {
                    eventTitle: action.targetEventTitle,
                    updates,
                    reason: action.reasoning || "Timeline cleanup merge",
                });
                console.log(`✏️ Updated: "${action.targetEventTitle}"`);
                eventsUpdated++;
            }

            if (action.action === "delete_event") {
                await ctx.runMutation(internal.api.deleteTimelineEvent, {
                    eventTitle: action.targetEventTitle,
                    reason: action.reasoning || "Merged with another event",
                });
                console.log(`🗑️ Deleted: "${action.targetEventTitle}"`);
                eventsDeleted++;
            }
        }

        const summary = result.summary || `Updated ${eventsUpdated}, deleted ${eventsDeleted} `;

        console.log("═══════════════════════════════════════════════════════════════");
        console.log(`🧹 TIMELINE CLEANUP COMPLETE`);
        console.log(`   Events updated: ${eventsUpdated} `);
        console.log(`   Events deleted: ${eventsDeleted} `);
        console.log(`   Summary: ${summary} `);
        console.log("═══════════════════════════════════════════════════════════════");

        return { eventsUpdated, eventsDeleted, summary };
    },
});
