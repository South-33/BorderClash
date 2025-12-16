"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { GHOST_API_URL } from "./config";

// =============================================================================
// GHOST API HELPER (shared with validation.ts)
// =============================================================================

async function callGhostAPI(prompt: string, model: "fast" | "thinking", maxRetries: number = 3): Promise<string> {
    console.log(`🤖 [GHOST API] Calling ${model} model...`);

    const RETRY_DELAY = 5000;
    let currentModel = model;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(`${GHOST_API_URL}/v1/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: prompt, model: currentModel }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                if ((response.status === 503 || response.status === 502 || response.status === 504)) {
                    if (currentModel === "thinking" && attempt === 1) {
                        console.warn(`⚠️ [GHOST API] ${response.status} with thinking model, falling back to fast...`);
                        currentModel = "fast";
                        continue;
                    }
                    if (attempt < maxRetries) {
                        console.warn(`⚠️ [GHOST API] Error ${response.status}, retrying in ${RETRY_DELAY / 1000}s...`);
                        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                        continue;
                    }
                }
                throw new Error(`Ghost API error (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(`Ghost API failed: ${data.error || "Unknown error"}`);
            }

            console.log(`✅ [GHOST API] Got response (${data.response?.length || 0} chars)`);
            return data.response || "";
        } catch (error: unknown) {
            if (currentModel === "thinking" && attempt === 1) {
                currentModel = "fast";
                continue;
            }
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                continue;
            }
            throw error;
        }
    }
    throw new Error("Ghost API failed after max retries");
}

// =============================================================================
// HISTORIAN PROMPT
// The "thinking" analyst that decides what becomes a timeline event
// =============================================================================

const HISTORIAN_PROMPT = `You are the HISTORIAN for BorderClash, a Thailand-Cambodia border conflict monitoring system.
Your job is to decide what news becomes PERMANENT HISTORICAL RECORD on the timeline.

⏱️ TIME CONSTRAINT: You have LIMITED processing time. Be EFFICIENT:
- Don't over-analyze. Make quick, confident decisions.

🔍 YOU CAN AND SHOULD:
- SEARCH THE WEB to verify claims
- VISIT SOURCE URLs directly before adding events to timeline
- CROSS-REFERENCE multiple sources

🌐 SEARCH IN MULTIPLE LANGUAGES:
- For Thai articles: Search in BOTH Thai (ชายแดนไทย-กัมพูชา, ข่าวทหาร) AND English
- For Cambodian articles: Search in BOTH Khmer (ព្រំដែនថៃ-កម្ពុជា, ព័ត៌មានកងទ័ព) AND English
- TIP: Native language sources often have more detail - try searching in the local language first!

🎯 YOUR CORE MISSION:
You are building a timeline that historians will reference 10 years from now.
Every event you add becomes part of the permanent record.
BE SELECTIVE. BE CRITICAL. BE SMART.

📅 DATE HANDLING - CRITICAL:
The "Published" date shown for each article MAY BE WRONG. News scrapers often get dates wrong.

BEFORE using a date, ask yourself:
1. Does this date make sense? (Not in the future? Not years ago?)
2. Does the article content mention when the event happened?
3. Can you verify the date by visiting the source URL or searching?

YOUR OPTIONS:
- If the Published date looks correct (matches article content) → Use it
- If the article says "yesterday" or "this morning" → Calculate from today's date
- If the event date is mentioned in the article → Use that, not Published date
- If unsure → Use today's date and note "date uncertain" in description

⏰ TIME OF DAY - CRITICAL FOR ACCURATE CHRONOLOGICAL ORDERING:
Events on the same day MUST be ordered correctly. The timeline should tell a coherent story.

ESTIMATE TIME BASED ON THESE CLUES:

📰 ARTICLE CONTEXT CLUES - Look for these phrases:
- "early morning", "at dawn", "before sunrise" → "05:00" or "06:00"
- "morning", "this morning" → "08:00" or "09:00"
- "midday", "noon", "around lunchtime" → "12:00"
- "afternoon", "this afternoon" → "14:00" or "15:00"
- "evening", "dusk", "end of day" → "18:00" or "19:00"
- "night", "overnight", "late night" → "22:00" or "23:00"
- "midnight", "early hours" → "00:00" or "02:00"

🎖️ MILITARY OPERATION TIMING PATTERNS:
- Dawn attacks are common → "05:00" to "06:00"
- Airstrikes often happen at night → "22:00" to "03:00"
- Troop movements often begin morning → "07:00" to "09:00"
- Press conferences/announcements are usually → "10:00" to "14:00"
- Diplomatic meetings/negotiations → "09:00" to "17:00"
- Evacuations/humanitarian ops → "06:00" to "18:00" (daylight hours)

⚠️ TIMELINE LOGIC - MAKE IT MAKE SENSE:
- If Event A CAUSED Event B, A must have earlier time than B
- Example: "Attack at dawn" should come BEFORE "Government responds to attack"
- Example: "Missile strike" should come BEFORE "Casualties reported from strike"
- If you have multiple events on the same day, think: "What order did these actually happen?"

🔢 TIME FORMAT:
- Use 24-hour format: "08:00", "14:30", "22:00"
- Be specific when you have clues, round to nearest hour when estimating
- If NO time indication at all → Use "12:00" as neutral default

⚠️ BEFORE ADDING TO TIMELINE:
If you're going to use "create_event" or "merge_source", you MUST:
1. VISIT the source URL to read the full article
2. Verify the event actually happened as described
3. Find the actual date of the event from the article content
4. Estimate a time of day if possible
5. Only then add it to the timeline

This is important because summaries may be incomplete or inaccurate.

📊 YOUR DECISION FRAMEWORK:

BEFORE adding an event, ask yourself:
1. "Would a historian 10 years from now care about this?" 
   - YES = Consider adding
   - NO = Archive it
   
2. "Is this truly VERIFIED or just a claim?"
   - Verified by multiple independent sources = Add with high confidence
   - Single source claim = Be skeptical, maybe add as "disputed"
   - Government press release only = Treat with skepticism from ALL governments

3. "Does this DUPLICATE an existing timeline event?"
   - If YES: Merge as an additional source, don't create new event
   - If NO: Consider creating new event

4. "What IMPORTANCE score should this get?" (0-100)
   - 90-100: War declarations, major battles, peace treaties, mass casualties
   - 70-89: Significant military actions, diplomatic breakthroughs, verified incidents
   - 50-69: Notable developments, confirmed troop movements, official statements with weight
   - 30-49: Routine but noteworthy events, minor skirmishes, diplomatic meetings
   - 0-29: Too minor for timeline - ARCHIVE instead


🔄 TIMELINE CLEANUP - MERGE & CONSOLIDATE EVENTS:
As you review the existing timeline, look for events that should be MERGED or CONSOLIDATED.

WHAT TO MERGE:

1. EXACT DUPLICATES - Same event, different wording:
   - "Shelling in Region 5" vs "Artillery attack in Region 5" → MERGE

2. SAME-DAY RELATED EVENTS - Multiple incidents that are part of one story:
   - "Dec 12 morning: Village bombed" + "Dec 12 evening: Village bombed again"
   → CONSOLIDATE into: "Dec 12: Village bombed in morning and evening attacks"
   
   - "Dec 13: Thai troops advance" + "Dec 13: Thai troops capture hill"
   → CONSOLIDATE into: "Dec 13: Thai troops advance and capture strategic hill"

3. FOLLOW-UPS that should be updates:
   - "Attack on village" + "Attack on village kills 5 (update)"
   → Keep the more complete one, delete the partial

SIGNS TO LOOK FOR:
- Same date + same location + same type of action = likely should be ONE event
- Sequential events that are part of the same operation/response
- One event is clearly a subset or update of another

HOW TO MERGE:
Use update_event + delete_event TOGETHER:
1. Pick the BETTER event to keep (more sources, more complete, higher importance)
2. Use "update_event" to COMBINE info: merge descriptions, combine time references, adjust importance UP
3. Use "delete_event" to remove the other, citing the merge in reasoning

Example 1 - Exact duplicate:
- Event A: "Shelling in Region 5" (importance 60)
- Event B: "Artillery attacks in Region 5 kill 3" (importance 70)
→ Keep B, update with A's sources, delete A

Example 2 - Same-day consolidation:
- Event A: "Dec 12 08:00 - Morning airstrike on border post" (importance 65)
- Event B: "Dec 12 19:00 - Evening airstrike on same border post" (importance 60)
→ Update A to: "Dec 12 - Airstrikes hit border post in morning and evening" (importance 75)
→ Delete B with reasoning: "Consolidated into single Dec 12 airstrike event"

⚠️ DO NOT MERGE if:
- Events are genuinely different incidents (different locations, different actors)
- Events span multiple days (keep separate for chronological accuracy)
- One is an attack, the other is a response (these tell a story - keep both)


⚠️ SYMMETRIC SKEPTICISM:
- Thai government claims need verification just like Cambodian ones
- International media has biases too (sensationalism, access limitations)
- "Official sources say" is NOT automatic truth from ANY country
- Cross-reference everything you can via web search

🚨 RED FLAGS (Lower importance or mark disputed):
- Extreme casualty claims without independent verification
- "Anonymous military source" as sole basis
- One-sided narrative with no acknowledgment of other perspective
- Dramatic claims that only appear in domestic media

✅ GREEN FLAGS (Higher importance):
- Confirmed by multiple independent sources (Thai + Cambodian + International)
- Specific verifiable details (locations, unit names, timestamps)
- Admissions against interest (e.g., country admits own losses)
- Video/photo evidence referenced

� CREDIBILITY VERIFICATION - YOUR SUBTASK:
For EVERY article you process, you MUST assess and update its credibility score.
This is critical - you are the last line of defense against propaganda and misinformation.

CREDIBILITY SCORING GUIDE (0-100):
- 90-100: VERIFIED TRUTH - Multiple independent sources confirm, specific evidence, no red flags
- 75-89: RELIABLE - Solid reporting, verifiable claims, minor gaps acceptable
- 60-74: CREDIBLE - Good source, mostly factual, some claims unverified
- 40-59: MIXED - Some facts + some unverified/biased claims, use with caution
- 25-39: QUESTIONABLE - Heavy bias, propaganda elements, unverified claims
- 10-24: UNRELIABLE - Obvious propaganda, one-sided, emotional language, no evidence
- 0-9: MISINFORMATION - Proven false, fabricated, fake source

WHEN YOU VISIT THE SOURCE URL, ASK:
1. Does the URL actually work? Does the source exist?
2. Does the content match the summary we have?
3. Does it cite evidence or just make claims?
4. Does it quote both sides or only one?
5. Can you find other sources that confirm this?
6. Is the language neutral or emotionally charged?

OUTPUT "verifiedCredibility" and "credibilityReason" for EVERY action.

�📋 ACTIONS YOU CAN TAKE:

1. "create_event" - Create a NEW timeline point
   Use when: Major verified event that deserves permanent record
   Requirements: MUST visit source URL first, get accurate date from article
   
2. "merge_source" - Add this article as a source to EXISTING event
   Use when: Article reports on something already in timeline
   Requirements: MUST visit source URL to verify it matches existing event

3. "update_event" - MODIFY an existing timeline event
   Use when:
   - New information CORRECTS a previous event (wrong date, updated details)
   - Event status should change (confirmed → disputed, or disputed → debunked)
   - Importance needs adjustment based on new developments
   - Better title/description is now available
   - MERGING duplicates: Update the better event with info from duplicate before deleting it
   Requirements:
   - MUST reference targetEventTitle EXACTLY as it appears in the timeline
   - MUST provide reasoning explaining what changed and why
   - Only update fields that actually need changing

4. "archive" - Article is TRUE but not important enough for timeline
   Use when: Routine news, minor updates, general commentary
   Result: Article marked as processed, not shown to future Historian runs

5. "discard" - Article is BROKEN or SPAM
   Use when: Duplicate URL, broken/fake source, actual spam/gibberish
   ⚠️ DO NOT discard low-credibility propaganda - use "archive" instead!
   Low-credibility articles are still valuable for understanding what citizens are being told.
   Result: Article hidden from future processing

6. "flag_conflict" - This article CONTRADICTS an existing timeline event
   Use when: New info disputes what's already on timeline but you're unsure which is correct
   Result: Triggers deeper investigation

7. "delete_event" - PERMANENTLY REMOVE an existing timeline event
   Use when: 
   - Event is COMPLETELY FABRICATED (never happened at all)
   - Event is a DUPLICATE of another event → DELETE after merging info into the better event!
   - Event was added by mistake (wrong conflict, wrong topic entirely)
   ✅ FOR MERGING DUPLICATES: Use update_event on the better event FIRST, then delete_event on the worse one
   DO NOT USE when:
   - Event has some inaccuracies (use update_event instead)
   - Event is disputed (set status to "disputed" instead)
   - Event was debunked (set status to "debunked" instead - keep for record!)
   Requirements:
   - MUST provide strong reasoning for why deletion is necessary
   - For merges, cite which event you merged it into

OUTPUT FORMAT - Wrap your JSON in <json> tags:
<json>
{
  "actions": [
    {
      "articleTitle": "Exact title of article from input",
      "articleCountry": "thailand|cambodia|international",
      "action": "create_event",
      "verifiedCredibility": 85,
      "credibilityReason": "Verified via Reuters, quotes both sides, specific evidence cited",
      "visitedSourceUrl": true,
      "eventData": {
        "date": "2024-12-12",
        "timeOfDay": "08:00",
        "title": "Short descriptive title in English (max 10 words)",
        "titleTh": "Thai translation - casual everyday language, not formal",
        "titleKh": "Khmer translation - casual everyday language (ភាសាខ្មែរ)",
        "description": "2-3 sentence detailed description in English",
        "descriptionTh": "Thai translation - everyday spoken Thai, not academic",
        "descriptionKh": "Khmer translation - everyday spoken Khmer (ភាសាខ្មែរប្រចាំថ្ងៃ)",
        "category": "military|diplomatic|humanitarian|political",
        "importance": 75,
        "sourceSnippet": "Key quote from the article"
      },
      "reasoning": "Why this deserves to be on the timeline"
    },
    {
      "articleTitle": "Another article",
      "articleCountry": "thailand",
      "action": "merge_source",
      "verifiedCredibility": 70,
      "credibilityReason": "Solid reporting, couldn't fully verify casualty claims",
      "visitedSourceUrl": true,
      "targetEventTitle": "Existing event title to merge into",
      "sourceSnippet": "Key quote to add as source",
      "reasoning": "This confirms the existing event"
    },
    {
      "articleTitle": "Article with correcting info",
      "articleCountry": "international",
      "action": "update_event",
      "visitedSourceUrl": true,
      "targetEventTitle": "Existing event title to update",
      "eventUpdates": {
        "description": "Updated description with new info",
        "descriptionTh": "Updated Thai translation",
        "descriptionKh": "Updated Khmer translation",
        "timeOfDay": "14:00",
        "importance": 85,
        "status": "disputed"
      },
      "reasoning": "New sources dispute the casualty count, updating status and details"
    },
    {
      "articleTitle": "Propaganda article",
      "articleCountry": "cambodia",
      "action": "archive",
      "verifiedCredibility": 25,
      "credibilityReason": "Heavy nationalist framing, unverified claims, no evidence cited",
      "reasoning": "Routine propaganda, not historically significant"
    },
    {
      "articleTitle": "Completely fake news",
      "articleCountry": "thailand",
      "action": "discard",
      "verifiedCredibility": 10,
      "credibilityReason": "URL is dead, source doesn't exist, event never happened",
      "reasoning": "Fabricated article with fake source"
    },
    {
      "articleTitle": "Completely fake news",
      "articleCountry": "thailand",
      "action": "delete_event",
      "targetEventTitle": "Fake Event That Never Happened",
      "reasoning": "This event was completely fabricated - no evidence it ever occurred"
    }
  ],
  "summary": "Processed X articles: Y events created, Z sources merged, W archived, V discarded. Credibility updated for all."
}
</json>

🌐 TRANSLATION RULES:
- ALWAYS provide Thai (titleTh, descriptionTh) and Khmer (titleKh, descriptionKh) translations for create_event
- For update_event, include translations if you're updating title/description
- Translation style: NATURAL, CONVERSATIONAL language - how a regular Thai/Khmer person would explain it to a friend or family member
- NOT formal academic language (ภาษาราชการ), NOT government-speak, NOT news anchor style
- Thai: Use ภาษาพูด (spoken Thai) - casual but respectful. Like how a Thai taxi driver or office worker would say it.
- Khmer: Use everyday spoken Khmer (ភាសាប្រចាំថ្ងៃ) - how a Cambodian shopkeeper or student would explain it.
- Use simple words that everyone understands - avoid technical jargon
- ALWAYS use English numerals (0-9) in ALL languages - NEVER Thai ๑๒๓ or Khmer ១២៣

RULES:
- You MUST include <json> and </json> tags
- Inside the tags, output valid JSON only
- For create_event, merge_source, and update_event, you MUST set visitedSourceUrl: true
- Every article in the input MUST have an action
- Use English numerals (0-9) only - NEVER Thai ๑๒๓ or Khmer ១២៣ numerals

📝 IMPORTANT - ORGANIZE ARTICLES BEFORE JSON:
Before outputting your JSON, you MUST first list each article with your plan for it.
This helps you keep track and avoid mixing up URLs/titles/actions between articles.

Example format (put this BEFORE the <json> tags):
---
ARTICLE ANALYSIS:
1. [CAMBODIA] "Hun Manet appeals to UN Security Council"
   → URL: https://freshnewsasia.com/xxxxx
   → Verified: ✅ Visited URL, content matches summary
   → Action: CREATE_EVENT (Major diplomatic development)
   → Credibility: 75 (Official government source)

2. [THAILAND] "Thai PM rejects ceasefire claims"
   → URL: https://thairath.co.th/yyyyy
   → Verified: ✅ Article exists, but summary overstated claims
   → Action: MERGE_SOURCE into "Thailand-Cambodia Ceasefire Talks Fail"
   → Credibility: 65 (Single-sided reporting)

3. [INTL] "Minor diplomatic update"
   → URL: https://reuters.com/zzzzz
   → Action: ARCHIVE (Routine, not historically significant)
---
<json>
{ ... your JSON actions matching the analysis above ... }
</json>

⚠️ DOUBLE-CHECK: Before outputting JSON, verify that:
- Each action's articleTitle matches exactly what you analyzed
- URLs are correctly associated with the right article
- You haven't mixed up Article 1's details with Article 2
`;

// =============================================================================
// PLANNER PROMPT
// Phase 1: Sees ALL articles, picks up to 10 most important to process
// =============================================================================

const PLANNER_PROMPT = `You are the PLANNER for BorderClash's Timeline Historian system.
Your job is to look at ALL pending articles and pick UP TO 10 MOST IMPORTANT ones to process right now.

🎯 YOUR MISSION:
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

    // Build timeline context with descriptions for better planning decisions
    const timelineContext = existingTimeline.length > 0
        ? existingTimeline.map(e => `- [${e.date}] ${e.title} (importance: ${e.importance})\n   ${e.description}`).join("\n")
        : "(Timeline is empty - this is your first run!)";

    const prompt = `${PLANNER_PROMPT}

═══════════════════════════════════════════════════════════════
📰 ALL PENDING ARTICLES (${allArticles.length} total):
${articlesContext}

📜 CURRENT TIMELINE (${existingTimeline.length} events):
${timelineContext}
═══════════════════════════════════════════════════════════════

Pick 5-10 articles to process now. Output your selection in JSON.`;

    console.log("🧠 [PLANNER] Analyzing all articles to pick best 5-10...");
    const response = await callGhostAPI(prompt, "fast", 2);  // Use fast model for planning

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
        console.log("❌ [PLANNER] No JSON found");
        return null;
    }

    const result = tryParseJson(tagMatch[1].trim());
    if (result && result.selectedArticles && Array.isArray(result.selectedArticles)) {
        console.log(`✅ [PLANNER] Selected ${result.selectedArticles.length} articles`);
        console.log(`   Reasoning: ${result.reasoning}`);
        return result.selectedArticles;
    }

    console.log("❌ [PLANNER] Invalid result structure or parse failed");
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

    // Build DETAILED timeline context with descriptions and TOP 3 source URLs for verification
    const timelineContext = existingTimeline.length > 0
        ? existingTimeline.map(e => {
            // Get top 3 most credible sources with URLs for verification
            const topSources = [...e.sources]
                .sort((a, b) => (b.credibility || 50) - (a.credibility || 50))
                .slice(0, 3);
            const sourceUrls = topSources.map(s => `${s.name} (cred:${s.credibility || 50}): ${s.url}`).join("\n     ");
            const timeDisplay = e.timeOfDay ? `, ${e.timeOfDay}` : "";
            return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 [${e.date}${timeDisplay}] ${e.title}
   Category: ${e.category} | Status: ${e.status} | Importance: ${e.importance}/100
   Description: ${e.description}
   Sources (${e.sources.length}):
     ${sourceUrls || "(none)"}`;
        }).join("\n")
        : "(Timeline is empty - this is your first run!)";

    const prompt = `${HISTORIAN_PROMPT}

═══════════════════════════════════════════════════════════════
📰 NEW ARTICLES TO PROCESS (${articles.length} articles):
${articlesContext}

📜 EXISTING TIMELINE (${existingTimeline.length} events):
${timelineContext}
═══════════════════════════════════════════════════════════════

Process each article above and decide its fate. Output your decisions in JSON.`;

    const response = await callGhostAPI(prompt, "thinking", 2);

    // Helper to clean and parse JSON with multiple fallback strategies
    const tryParseJson = (jsonStr: string): HistorianResult | null => {
        // Strategy 1: Direct parse (fastest)
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

        const repairResponse = await callGhostAPI(repairPrompt, "fast", 1);
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

        // 2. Get existing timeline for context (increased limit)
        const timeline = await ctx.runQuery(internal.api.getRecentTimeline, {
            limit: 100
        });
        console.log(`📜 Current timeline has ${timeline.length} events`);

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
                        // Validate category if provided
                        const updates = { ...action.eventUpdates } as any;

                        // Strip out 'reasoning' if AI included it in updates (not in validator)
                        delete updates.reasoning;

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

const CLEANUP_PROMPT = `You are the TIMELINE CURATOR for BorderClash.
Your ONLY job right now is to review the existing timeline and find events that should be MERGED or CONSOLIDATED.

🎯 YOUR MISSION:
Look at the timeline below and identify:
1. DUPLICATE EVENTS - Same incident reported with different wording
2. SAME-DAY RELATED EVENTS - Multiple entries for the same day that should be ONE event
3. SEQUENTIAL EVENTS - Events that are clearly part of one operation/story

📋 EXAMPLES OF WHAT TO MERGE:

Example 1 - Duplicates:
- "Shelling in Military Region 5" + "Artillery attack in Region 5"
→ MERGE: Keep the more detailed one, delete the other

Example 2 - Same-day consolidation:
- "Dec 12 08:00 - Morning airstrike" + "Dec 12 19:00 - Evening airstrike on same target"  
→ CONSOLIDATE: "Dec 12 - Airstrikes hit target in morning and evening" (delete the other)

Example 3 - Sequential operations:
- "Dec 13: Troops advance to hill" + "Dec 13: Troops capture hill"
→ CONSOLIDATE: "Dec 13: Troops advance and capture strategic hill"

⚠️ DO NOT MERGE:
- Events at different locations (genuinely different incidents)
- Events on different days (chronology matters)
- Attack + Response pairs (they tell a story)
- Events involving different actors

📋 ACTIONS YOU CAN TAKE:

1. "update_event" - Modify an event to include info from another before deleting
   - targetEventTitle: EXACT title of the event to update
   - eventUpdates: { title, description, importance, etc. }
   - reasoning: Why you're updating (e.g., "Consolidating with [other event]")

2. "delete_event" - Remove a duplicate/merged event
   - targetEventTitle: EXACT title to delete
   - reasoning: "Merged into [title of kept event]"

3. "no_action" - Use if timeline is already clean!

OUTPUT FORMAT:
\`\`\`json
{
  "analysis": "Brief summary of what you found",
  "mergeActions": [
    {
      "action": "update_event",
      "targetEventTitle": "Event to keep and update",
      "eventUpdates": {
        "title": "New consolidated title",
        "titleTh": "Thai translation",
        "titleKh": "Khmer translation", 
        "description": "Combined description mentioning both incidents",
        "descriptionTh": "Thai translation",
        "descriptionKh": "Khmer translation",
        "importance": 75
      },
      "reasoning": "Consolidating morning and evening attacks into single event"
    },
    {
      "action": "delete_event", 
      "targetEventTitle": "Event to remove after merge",
      "reasoning": "Merged into 'New consolidated title'"
    }
  ],
  "summary": "Merged X events, deleted Y duplicates, timeline now has Z events"
}
\`\`\`

🌐 TRANSLATION RULES:
- ALWAYS provide Thai (titleTh, descriptionTh) and Khmer (titleKh, descriptionKh) translations for updates
- For update_event, include translations if you're updating title/description
- Translation style: NATURAL, CONVERSATIONAL language - how a regular Thai/Khmer person would explain it to a friend or family member
- NOT formal academic language (ภาษาราชการ), NOT government-speak, NOT news anchor style
- Thai: Use ภาษาพูด (spoken Thai) - casual but respectful. Like how a Thai taxi driver or office worker would say it.
- Khmer: Use everyday spoken Khmer (ភាសាប្រចាំថ្ងៃ) - how a Cambodian shopkeeper or student would explain it.
- Use simple words that everyone understands - avoid technical jargon
- ALWAYS use English numerals (0-9) in ALL languages - NEVER Thai ๑๒๓ or Khmer ១២៣

Now review this timeline and find events to merge:
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
        date: v.optional(v.string()),  // Optional: process only events for this date (e.g., "2025-12-12")
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
        const allTimeline = await ctx.runQuery(internal.api.getRecentTimeline, {
            limit: 100
        });

        // Filter by date if provided
        const timeline = args.date
            ? allTimeline.filter((e: any) => e.date === args.date)
            : allTimeline;

        if (args.date) {
            console.log(`📅 Filtering to date: ${args.date}`);
            console.log(`   Found ${timeline.length} events on this date (out of ${allTimeline.length} total)`);
        }

        if (timeline.length < 2) {
            console.log("✅ Fewer than 2 events for this date - nothing to merge");
            return { eventsUpdated: 0, eventsDeleted: 0, summary: "Too few events to merge" };
        }

        console.log(`📜 Reviewing ${timeline.length} timeline events for merges...`);

        // Build timeline context for AI
        const timelineContext = timeline.map((e: any, idx: number) => {
            const timeDisplay = e.timeOfDay ? ` ${e.timeOfDay}` : "";
            return `${idx + 1}. [${e.date}${timeDisplay}] "${e.title}" 
   Category: ${e.category} | Importance: ${e.importance}/100 | Sources: ${e.sources?.length || 0}
   Description: ${e.description}`;
        }).join("\n\n");

        const prompt = `${CLEANUP_PROMPT}

═══════════════════════════════════════════════════════════════
📜 CURRENT TIMELINE (${timeline.length} events):
${timelineContext}
═══════════════════════════════════════════════════════════════

Find duplicate or related events that should be merged. Output JSON with your merge actions.`;

        const response = await callGhostAPI(prompt, "thinking", 2);

        // Extract JSON
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/i) ||
            response.match(/\{[\s\S]*"mergeActions"[\s\S]*\}/);

        if (!jsonMatch) {
            console.log("❌ [CLEANUP] No JSON found in response");
            return { eventsUpdated: 0, eventsDeleted: 0, summary: "AI returned no actions" };
        }

        let result: CleanupResult;
        try {
            const jsonStr = jsonMatch[1] || jsonMatch[0];
            result = JSON.parse(jsonStr.trim());
        } catch (e) {
            console.log(`❌ [CLEANUP] JSON parse error: ${e}`);
            return { eventsUpdated: 0, eventsDeleted: 0, summary: "Failed to parse AI response" };
        }

        console.log(`📊 AI Analysis: ${result.analysis}`);
        console.log(`🎯 Found ${result.mergeActions?.length || 0} merge actions`);

        let eventsUpdated = 0;
        let eventsDeleted = 0;

        // Execute merge actions
        for (const action of result.mergeActions || []) {
            if (action.action === "no_action") continue;

            if (action.action === "update_event" && action.eventUpdates) {
                // Validate updates
                const updates: any = { ...action.eventUpdates };

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

        const summary = result.summary || `Updated ${eventsUpdated}, deleted ${eventsDeleted}`;

        console.log("═══════════════════════════════════════════════════════════════");
        console.log(`🧹 TIMELINE CLEANUP COMPLETE`);
        console.log(`   Events updated: ${eventsUpdated}`);
        console.log(`   Events deleted: ${eventsDeleted}`);
        console.log(`   Summary: ${summary}`);
        console.log("═══════════════════════════════════════════════════════════════");

        return { eventsUpdated, eventsDeleted, summary };
    },
});
