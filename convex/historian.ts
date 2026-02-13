"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { MODELS, FALLBACK_CHAINS } from "./config";
import { callGeminiStudio, callGeminiStudioWithFallback, formatTimelineEvent } from "./ai_utils";


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

📊 IMPORTANCE SCALE (0-100) — USE THIS STRICTLY:
- 90-100: Conflict-defining turning points. Major battles, treaty signing, regime-level shifts.
- 80-89: Major strategic shifts. New front opened/closed, large force moves, formal high-stakes state decisions.
- 70-79: Story-critical state changes. Important but not decisive milestones readers MUST know.
- 60-69: Real and useful updates, but supporting detail (usually not key-event material).
- 40-59: Minor/redundant/reactive updates. Usually archive unless needed to preserve chronology.
- 0-39: Noise, weakly evidenced claims, or repetitive commentary → ARCHIVE/DISCARD.

⚠️ HIGH-IMPACT DISCIPLINE (CRITICAL):
- 70+ is RESERVED for events that materially change the conflict story.
- If this article is just a small update to an existing thread, prefer merge_source/update_event and keep importance below 70.
- Repeated reports on the same incident should trend DOWN in importance unless they add decisive new facts.
- For running totals (displaced/casualties), only assign 70+ when a major milestone is crossed or policy/operational reality changes.

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

const PLANNER_PROMPT = `Select 5-10 articles to process next.

STRATEGY:
1. Look for a "Main Event" (a cluster of articles about the same incident). Pick ALL articles related to it.
2. If that's fewer than 5, fill the rest of the quota (up to 10) with the next most important independent updates.

PRIORITIZE: Breaking news, heavily corroborated events.
SKIP FOR LATER: Low-value opinion pieces if you have better news.

OUTPUT FORMAT (wrap in <json> tags):
<json>
{
  "selectedArticles": ["Exact title 1", "Exact title 2", "..."],
  "reasoning": "Selected [Event A] cluster and [Event B] updates"
}
</json>

Copy article titles EXACTLY from the input list.
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

    // Helper to clean and parse JSON with multiple fallback strategies
    const tryParseJson = (jsonStr: string): any => {
        try { return JSON.parse(jsonStr); } catch { /* continue */ }
        try {
            const cleaned = jsonStr
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
                .replace(/,\s*([\]\}])/g, '$1');
            return JSON.parse(cleaned);
        } catch { /* continue */ }
        return null;
    };

    // RETRY LOOP (3 attempts)
    const MAX_RETRIES = 3;
    let currentPrompt = prompt;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        console.log(`🧠 [PLANNER] Attempt ${attempt}/${MAX_RETRIES}...`);

        try {
            const response = await callGeminiStudio(currentPrompt, MODELS.fast, 2);

            // Extract JSON
            const tagMatch = response.match(/<json>([\s\S]*?)<\/json>/i);
            if (!tagMatch) {
                console.log(`❌ [PLANNER] Attempt ${attempt}: No <json> tags found`);
                if (attempt < MAX_RETRIES) {
                    // SHORT repair prompt - don't resend full article list
                    currentPrompt = `Your response had no <json> tags. Output ONLY:\n<json>\n{"selectedArticles": ["Title 1", "Title 2", ...], "reasoning": "..."}\n</json>\n\nSelect 5-10 from the list you already saw.`;
                    continue;
                }
                return null;
            }

            const result = tryParseJson(tagMatch[1].trim());
            if (result && result.selectedArticles && Array.isArray(result.selectedArticles)) {
                console.log(`✅ [PLANNER] Selected ${result.selectedArticles.length} articles`);
                if (result.reasoning) console.log(`   Reasoning: ${result.reasoning}`);
                return result.selectedArticles;
            }

            // Wrong structure - retry with feedback
            console.log(`❌ [PLANNER] Attempt ${attempt}: Wrong JSON structure (missing selectedArticles)`);
            console.log(`   Got: ${tagMatch[1].substring(0, 150)}...`);
            if (attempt < MAX_RETRIES) {
                // SHORT repair prompt - just tell it what was wrong
                currentPrompt = `Wrong format. You returned: ${tagMatch[1].substring(0, 200)}...\n\nOutput ONLY:\n<json>\n{"selectedArticles": ["Exact Title 1", "Exact Title 2", ...]}\n</json>`;
            }
        } catch (error) {
            // Network error - wait before retry
            console.log(`❌ [PLANNER] Attempt ${attempt} network error: ${error}`);
            if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, 3000));
                currentPrompt = prompt; // Reset to original prompt for network retries
            }
        }
    }

    console.log("ℹ️ [PLANNER] All attempts failed - falling back to default article selection");
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
    }>,
    newsContext?: Record<string, Array<{
        title: string;
        summary: string;
        date: string;
        source: string;
        sourceUrl: string;
        credibility: number;
    }>>
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

    // Build lean news context section (latest 20 already-processed articles per country)
    // This gives the Historian awareness of what's been happening without processing overhead
    let newsContextSection = "";
    if (newsContext) {
        const formatCountryContext = (articles: typeof newsContext.TH, label: string) => {
            if (!articles || articles.length === 0) return "";
            return `[${label}]\n` + articles.map(a =>
                `• "${a.title}" (${a.date}, cred:${a.credibility})\n  ${a.source}: ${a.sourceUrl}\n  ${a.summary.substring(0, 100)}...`
            ).join("\n");
        };

        const thContext = formatCountryContext(newsContext.TH, "THAI NEWS");
        const khContext = formatCountryContext(newsContext.KH, "CAMBODIAN NEWS");
        const intContext = formatCountryContext(newsContext.INT, "INTERNATIONAL NEWS");

        if (thContext || khContext || intContext) {
            newsContextSection = `
📊 RECENT NEWS CONTEXT (already processed - for your awareness only):
${thContext}

${khContext}

${intContext}
`;
        }
    }

    const prompt = `${HISTORIAN_PROMPT}

═══════════════════════════════════════════════════════════════
📰 NEW ARTICLES TO PROCESS (${articles.length} articles):
${articlesContext}

📜 EXISTING TIMELINE (${existingTimeline.length} events):
${timelineContext}
${newsContextSection}
═══════════════════════════════════════════════════════════════

Process each article above and decide its fate. Output your decisions in JSON.`;

    // Helper to clean and parse JSON with multiple fallback strategies
    const tryParseJson = (jsonStr: string): HistorianResult | null => {
        try { return JSON.parse(jsonStr); } catch { /* continue */ }
        try {
            const cleaned = jsonStr
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

    // RETRY LOOP (3 attempts)
    const MAX_RETRIES = 3;
    let currentPrompt = prompt;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        console.log(`📜 [HISTORIAN] Attempt ${attempt}/${MAX_RETRIES}...`);

        try {
            const response = await callGeminiStudioWithFallback(currentPrompt, FALLBACK_CHAINS.critical, 2, "HISTORIAN");

            // Extract JSON from response
            const tagMatch = response.match(/<json>([\s\S]*?)<\/json>/i);
            let jsonStr: string | null = null;

            if (tagMatch) {
                jsonStr = tagMatch[1].trim();
            } else {
                // Fallback: try to find raw JSON
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) jsonStr = jsonMatch[0];
            }

            if (!jsonStr) {
                console.log(`❌ [HISTORIAN] Attempt ${attempt}: No JSON found`);
                if (attempt < MAX_RETRIES) {
                    // SHORT repair prompt
                    currentPrompt = `Your response had no JSON. Output ONLY:\n<json>\n{"actions": [{"articleTitle": "...", "action": "create_event|archive|discard", ...}], "summary": "..."}\n</json>\n\nProcess the articles you already saw.`;
                    continue;
                }
                return null;
            }

            // Try to parse
            let result = tryParseJson(jsonStr);

            // If parse failed, try AI repair
            if (!result) {
                console.log(`🔧 [HISTORIAN] Attempt ${attempt}: JSON parse failed, asking AI to repair...`);
                try {
                    const repairPrompt = `Fix this broken JSON and output ONLY valid JSON in <json> tags:\n\n${jsonStr.substring(0, 2000)}`;
                    const repairResponse = await callGeminiStudio(repairPrompt, MODELS.fast, 1);
                    const repairMatch = repairResponse.match(/<json>([\s\S]*?)<\/json>/i);
                    if (repairMatch) {
                        result = tryParseJson(repairMatch[1].trim());
                        if (result) console.log(`✅ [HISTORIAN] JSON repaired by AI`);
                    }
                } catch (repairError) {
                    console.log(`❌ [HISTORIAN] AI repair failed: ${repairError}`);
                }
            }

            // Validate result structure
            if (result && result.actions && Array.isArray(result.actions)) {
                console.log(`✅ [HISTORIAN] Got ${result.actions.length} actions`);
                return result;
            }

            console.log(`❌ [HISTORIAN] Attempt ${attempt}: Invalid structure (missing actions array)`);
            if (attempt < MAX_RETRIES) {
                // SHORT repair prompt
                currentPrompt = `Wrong format. Output ONLY:\n<json>\n{"actions": [{"articleTitle": "...", "action": "...", "eventData": {...}}]}\n</json>`;
            }
        } catch (error) {
            // Network error - wait before retry
            console.log(`❌ [HISTORIAN] Attempt ${attempt} network error: ${error}`);
            if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, 5000));
                currentPrompt = prompt; // Reset to original for network retries
            }
        }
    }

    console.log("❌ [HISTORIAN] All attempts failed");
    console.log("ℹ️ [HISTORIAN] No timeline changes will be made - existing events preserved");
    return null;
}

// =============================================================================
// MAIN HISTORIAN ACTION
// Two-phase approach: Planner picks, Historian processes
// =============================================================================

export const runHistorianCycle = internalAction({
    args: {
        // Optional cached data to reduce bandwidth when called in a loop
        cachedTimeline: v.optional(v.array(v.any())),
        cachedNewsContext: v.optional(v.any()),
    },
    handler: async (ctx, { cachedTimeline, cachedNewsContext }): Promise<{
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

        // 2. Get existing timeline for context (use cache if provided)
        const timeline = cachedTimeline ?? await ctx.runQuery(internal.api.getRecentTimeline, {
            limit: 150  // Recent events only - older events rarely need updates
        });
        console.log(`📜 Timeline context: ${timeline.length} recent events${cachedTimeline ? " (cached)" : ""}`);

        // 3. Get timeline stats (always fresh - small query)
        const timelineStats = await ctx.runQuery(internal.api.getTimelineStats, {});
        console.log(`📊 Timeline stats: ${timelineStats.totalEvents} events, avg importance: ${timelineStats.avgImportance}`);

        // 4. Get recent news context (use cache if provided)
        // This gives the Historian situational awareness without processing overhead
        const newsContext = cachedNewsContext ?? await ctx.runQuery(internal.api.getRecentNewsContextForHistorian, {});
        console.log(`📰 News context: TH=${newsContext.TH.length}, KH=${newsContext.KH.length}, INT=${newsContext.INT.length}${cachedNewsContext ? " (cached)" : ""}`);

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
            // Pre-filter to top 50 by credibility to avoid overwhelming the Planner
            const maxPlannerArticles = 50;
            const articlesForPlanner = allArticles.length > maxPlannerArticles
                ? allArticles.slice(0, maxPlannerArticles)
                : allArticles;

            if (allArticles.length > maxPlannerArticles) {
                console.log(`   ⚠️ ${allArticles.length} articles too many - sending top ${maxPlannerArticles} to Planner`);
            }

            // Run Planner to pick 5-10
            const plannerSelection = await runPlanner(
                articlesForPlanner.map((a: any) => ({
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
            })),
            newsContext  // Pass recent news context for situational awareness
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
            if (!str) return "";
            return str
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&#39;/g, "'")
                .replace(/&apos;/g, "'");
        };

        for (const action of historianResult.actions) {
            // Safety check for missing title
            if (!action.articleTitle) {
                console.log(`⚠️ Unprocessable action (missing articleTitle): ${JSON.stringify(action)}`);
                continue;
            }

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

OUTPUT ONLY valid JSON wrapped in <json> tags:
<json>
{
  "scores": [
    { "eventId": "exact id", "importance": 0-100, "reason": "short reason" }
  ],
  "reasoning": "brief batch-level rationale"
}
</json>

REQUIREMENTS:
- Include every eventId from CURRENT BATCH exactly once.
- importance must be integer 0-100.
- Do not include events outside CURRENT BATCH.
`;

function tryParseImpactRescoreJson(raw: string): ImpactRescoreResult | null {
    const tagMatch = raw.match(/<json>([\s\S]*?)<\/json>/i);
    const jsonCandidate = tagMatch ? tagMatch[1].trim() : raw.trim();

    const attempts = [
        jsonCandidate,
        jsonCandidate
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

    const batchContext = batchEvents.map((event, index) =>
        {
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

═══════════════════════════════════════════════════════════════
LOOKBACK CONTEXT (already rescored, chronological):
${lookbackContext}

CURRENT BATCH (${batchEvents.length} events):
${batchContext}
═══════════════════════════════════════════════════════════════

Return rescored importance for every event in CURRENT BATCH.`;

    const maxRetries = 3;
    let currentPrompt = prompt;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`🎚️ [IMPACT-RESCORE] Attempt ${attempt}/${maxRetries} for ${batchEvents.length} events...`);

        try {
            const response = await callGeminiStudioWithFallback(
                currentPrompt,
                FALLBACK_CHAINS.critical,
                1,
                "IMPACT-RESCORE"
            );

            const parsed = tryParseImpactRescoreJson(response);
            if (parsed && Array.isArray(parsed.scores)) {
                return parsed;
            }

            if (attempt < maxRetries) {
                currentPrompt = `${prompt}\n\nYour previous response was invalid. Re-output now using ONLY valid JSON wrapped in <json> tags. Include every eventId from CURRENT BATCH exactly once.`;
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
            modelChain: readonly string[];
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
                modelChain: FALLBACK_CHAINS.critical,
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

OUTPUT ONLY valid JSON wrapped in <json> tags:
<json>
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
</json>

REQUIREMENTS:
- Every event in CURRENT BATCH must appear once in actions (usually as no_action unless change is needed).
- Use event IDs exactly as provided.
- Prefer no_action over speculative edits.
`;

function tryParseCanonicalizationJson(raw: string): CanonicalizationResult | null {
    const tagMatch = raw.match(/<json>([\s\S]*?)<\/json>/i);
    const fencedMatch = raw.match(/```json\s*([\s\S]*?)```/i);
    const jsonCandidate = tagMatch
        ? tagMatch[1].trim()
        : fencedMatch
            ? fencedMatch[1].trim()
            : raw.trim();

    const attempts = [
        jsonCandidate,
        jsonCandidate
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

═══════════════════════════════════════════════════════════════
CURRENT BATCH (${events.length} events):
${eventContext}
═══════════════════════════════════════════════════════════════`;

    const maxRetries = 3;
    let currentPrompt = prompt;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`🧹 [CANONICALIZE] Attempt ${attempt}/${maxRetries} for ${events.length} events...`);
        try {
            const response = await callGeminiStudioWithFallback(
                currentPrompt,
                FALLBACK_CHAINS.critical,
                1,
                "CANONICALIZE"
            );

            const parsed = tryParseCanonicalizationJson(response);
            if (parsed && Array.isArray(parsed.actions)) {
                return parsed;
            }

            if (attempt < maxRetries) {
                currentPrompt = `${prompt}\n\nYour previous output was invalid. Re-output valid JSON in <json> tags with one action per event id.`;
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
