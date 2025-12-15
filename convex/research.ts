"use node";

import { internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";

// =============================================================================
// GHOST API HELPER (Browser automation - no rate limits!)
// =============================================================================

// Use Koyeb URL for production, fallback to local for testing
import { GHOST_API_URL } from "./config";

// Note: We don't specify explicit dates in prompts.
// Gemini determines "today" naturally and extracts absolute dates from articles.

/**
 * Call the Ghost API which uses browser automation to access Gemini
 * @param prompt - The prompt to send
 * @param model - "fast" (Flash equivalent) or "thinking" (Pro equivalent)
 * @returns The response text
 */
async function callGhostAPI(prompt: string, model: "fast" | "thinking", maxRetries: number = 3): Promise<string> {
    console.log(`🤖 [GHOST API] Calling ${model} model...`);

    const RETRY_DELAY = 5000; // 5 seconds
    const PENDING_POLL_DELAY = 45000; // Wait 45s before polling for pending result
    const PENDING_POLL_INTERVAL = 10000; // Poll every 10s
    const PENDING_MAX_POLLS = 12; // Max 2 minutes of polling (12 * 10s)

    // Generate unique request ID for timeout recovery
    const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const startTime = Date.now();
        try {
            const response = await fetch(`${GHOST_API_URL}/v1/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: prompt, model, request_id: requestId }),
            });

            const duration = Date.now() - startTime;

            if (!response.ok) {
                const errorText = await response.text();
                // Truncate error to avoid log pollution
                const safeError = errorText.substring(0, 200) + (errorText.length > 200 ? "..." : "");
                console.warn(`⚠️ [GHOST API] Error ${response.status} after ${duration}ms`);

                // Check for 504 Gateway Timeout - worker might still be processing
                if (response.status === 504) {
                    console.log(`⏳ [GHOST API] HTTP timeout (504) - worker may still be processing...`);
                    console.log(`⏳ [GHOST API] Waiting ${PENDING_POLL_DELAY / 1000}s before polling for result...`);

                    // Wait for the worker to finish
                    await new Promise(resolve => setTimeout(resolve, PENDING_POLL_DELAY));

                    // Poll for pending result
                    for (let poll = 1; poll <= PENDING_MAX_POLLS; poll++) {
                        console.log(`🔍 [GHOST API] Polling for pending result (attempt ${poll}/${PENDING_MAX_POLLS})...`);

                        try {
                            const pendingResponse = await fetch(`${GHOST_API_URL}/v1/pending/${requestId}`);

                            if (pendingResponse.ok) {
                                const pendingData = await pendingResponse.json();

                                if (pendingData.success && pendingData.response) {
                                    console.log(`✅ [GHOST API] Retrieved pending result (${pendingData.response.length} chars)`);
                                    return pendingData.response;
                                }
                            }
                        } catch (pollError) {
                            console.warn(`⚠️ [GHOST API] Poll error: ${pollError}`);
                        }

                        // Wait before next poll
                        if (poll < PENDING_MAX_POLLS) {
                            await new Promise(resolve => setTimeout(resolve, PENDING_POLL_INTERVAL));
                        }
                    }

                    console.warn(`⚠️ [GHOST API] Pending result not found after polling`);
                }

                throw new Error(`Ghost API error (${response.status}): ${safeError}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(`Ghost API failed: ${data.error || "Unknown error"}`);
            }

            console.log(`✅ [GHOST API] Got response (${data.response?.length || 0} chars) in ${duration}ms`);
            return data.response || "";

        } catch (error) {
            const duration = Date.now() - startTime;
            console.warn(`⚠️ [GHOST API] Attempt ${attempt}/${maxRetries} failed after ${duration}ms: ${error}`);

            if (attempt < maxRetries) {
                console.log(`⏳ [GHOST API] Retrying in ${RETRY_DELAY / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            } else {
                console.error(`❌ [GHOST API] All ${maxRetries} attempts failed.`);
                throw error; // Re-throw the last error
            }
        }
    }

    throw new Error("Ghost API failed after max retries");
}

/**
 * Call the Ghost API Deep Research endpoint
 * @param message - The research query
 * @param extractSources - If true, extracts sources list instead of report content
 * @returns The response (sources JSON if extractSources=true)
 */
async function callGhostDeepResearch(message: string, extractSources: boolean = false): Promise<string> {
    console.log(`🔬 [DEEP RESEARCH] Starting research...`);
    if (extractSources) {
        console.log(`� [DEEP RESEARCH] Will extract sources list`);
    }

    const startTime = Date.now();
    const response = await fetch(`${GHOST_API_URL}/v1/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message,
            // Magic string to trigger source extraction mode
            follow_up_prompt: extractSources ? "__EXTRACT_SOURCES__" : undefined,
        }),
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
        const errorText = await response.text();
        console.warn(`⚠️ [DEEP RESEARCH] Error ${response.status} after ${duration}ms`);
        throw new Error(`Ghost API Deep Research error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    if (!data.success) {
        throw new Error(`Ghost API Deep Research failed: ${data.error || "Unknown error"}`);
    }

    console.log(`✅ [DEEP RESEARCH] Got response (${data.response?.length || 0} chars) in ${duration}ms`);
    return data.response || "";
}

/**
 * GENERIC SELF-HEALING HELPER
 * Handles retry logic, model fallback (Thinking -> Fast), and JSON repair
 * Extracts JSON from <json>...</json> tags first, then falls back to regex
 */
async function callGhostWithSelfHealing<T>(
    prompt: string,
    initialModel: "thinking" | "fast" = "thinking",
    maxRetries: number = 3,
    debugLabel: string = "GHOST",
    modelSequence?: Array<"thinking" | "fast"> // Optional: explicit model for each attempt
): Promise<T | null> {
    let currentPrompt = prompt;
    let modelToUse = initialModel;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let rawResponse = "";
        try {
            // Determine model: use sequence if provided, else default behavior
            const actualModel = modelSequence && modelSequence[attempt - 1]
                ? modelSequence[attempt - 1]
                : (attempt > 1 ? "fast" : modelToUse);
            console.log(`🤖 [${debugLabel}] Attempt ${attempt}/${maxRetries} (${actualModel})...`);

            // Add speed hint on 2nd thinking attempt
            let promptToSend = currentPrompt;
            if (attempt === 2 && actualModel === "thinking") {
                promptToSend = `⏱️ SPEED NOTE: please work efficiently to avoid timeout. Maintain accuracy.\n\n${currentPrompt}`;
            }

            // 1. CALL API
            try {
                rawResponse = await callGhostAPI(promptToSend, actualModel, 1);
            } catch (networkError: any) {
                // Handle Network/Timeout
                const errStr = String(networkError);
                if ((errStr.includes("504") || errStr.includes("502") || errStr.includes("timeout")) && modelToUse === "thinking") {
                    console.log(`⚠️ [${debugLabel}] Timeout. Downgrading to Fast model...`);
                    modelToUse = "fast";
                    rawResponse = await callGhostAPI(currentPrompt, "fast", 1);
                } else {
                    throw networkError;
                }
            }

            // 2. EXTRACT JSON - Try <json> tags first, then fallback to regex
            let jsonStr: string | null = null;

            // Method 1: Look for <json>...</json> tags (preferred)
            const tagMatch = rawResponse.match(/<json>([\s\S]*?)<\/json>/i);
            if (tagMatch) {
                jsonStr = tagMatch[1].trim();
                console.log(`✅ [${debugLabel}] Extracted JSON from <json> tags`);
            } else {
                // Method 2: Fallback - strip markdown first, then find { to }
                const cleanedResponse = rawResponse
                    .replace(/```json\s*/g, "").replace(/```\s*/g, "")
                    .trim();
                const firstOpen = cleanedResponse.indexOf('{');
                const lastClose = cleanedResponse.lastIndexOf('}');
                if (firstOpen !== -1 && lastClose !== -1) {
                    jsonStr = cleanedResponse.substring(firstOpen, lastClose + 1);
                }
            }

            if (!jsonStr) {
                throw new Error("No JSON object found in response");
            }

            // 3. CLEAN JSON (minimal - don't break Thai/Khmer text)
            jsonStr = jsonStr.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control chars
            jsonStr = jsonStr.replace(/,\s*([\]\}])/g, '$1'); // Remove trailing commas

            // 4. PARSE
            try {
                return JSON.parse(jsonStr) as T;
            } catch (parseError: any) {
                console.log(`⚠️ [${debugLabel}] JSON Parse Error: ${parseError.message}`);

                if (attempt < maxRetries) {
                    console.log(`🔄 [${debugLabel}] Constructing repair prompt...`);
                    // PREPARE REPAIR PROMPT - Ask for <json> tags
                    currentPrompt = `Your previous response had invalid JSON. Please fix it.

--- ORIGINAL TASK ---
${prompt}
--- END TASK ---

--- YOUR BROKEN RESPONSE ---
${rawResponse.substring(0, 2000)}${rawResponse.length > 2000 ? '...(truncated)' : ''}
--- END RESPONSE ---

--- ERROR ---
${parseError.message}
---

Please output the FIXED JSON wrapped in <json> tags:
<json>
{ ... your corrected JSON here ... }
</json>`;
                    continue; // Retry loop with new prompt
                } else {
                    throw parseError;
                }
            }

        } catch (e: any) {
            lastError = e;
            console.error(`❌ [${debugLabel}] Attempt ${attempt} failed: ${e.message}`);
        }
    }

    return null;
}

// =============================================================================
// GHOST API UTILS - Ping & Reset
// =============================================================================

export const pingGhostAPI = internalAction({
    args: {},
    handler: async (): Promise<void> => {
        try {
            // 1. Health check ping (keeps Koyeb instance awake)
            const response = await fetch(`${GHOST_API_URL}/health`, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
            });

            if (response.ok) {
                const data = await response.json();
                console.log(`🏓 [KEEPALIVE] Ghost API ping successful: ${data.message || "healthy"}`);
            } else {
                console.log(`⚠️ [KEEPALIVE] Ghost API ping failed: ${response.status}`);
            }

            // 2. Cookie refresh (harvests fresh cookies and revives dead workers)
            try {
                const refreshResponse = await fetch(`${GHOST_API_URL}/v1/refresh`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                });

                if (refreshResponse.ok) {
                    const refreshData = await refreshResponse.json();
                    if (refreshData.revived > 0) {
                        console.log(`🍪 [KEEPALIVE] Cookie refresh: Revived ${refreshData.revived} workers!`);
                    } else if (refreshData.still_dead > 0) {
                        console.log(`🍪 [KEEPALIVE] Cookie refresh: ${refreshData.still_dead} workers still dead`);
                    }
                }
            } catch (refreshError) {
                // Non-fatal - refresh might not be implemented in older versions
                console.log(`⚠️ [KEEPALIVE] Cookie refresh unavailable`);
            }
        } catch (error) {
            console.log(`❌ [KEEPALIVE] Ghost API unreachable: ${error}`);
        }
    },
});

export const resetGhostAPI = internalAction({
    args: {},
    handler: async (): Promise<void> => {
        console.log("🔄 [RESET] Sending reset signal to Ghost API...");
        try {
            const response = await fetch(`${GHOST_API_URL}/v1/reset`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });

            if (response.ok) {
                console.log("✅ [RESET] Ghost API successfully reset.");
            } else {
                console.log(`⚠️ [RESET] Reset failed: ${response.status} ${await response.text()}`);
            }
        } catch (error) {
            console.log(`❌ [RESET] Could not reach Ghost API: ${error}`);
        }
    },
});

// =============================================================================
// DEEP RESEARCH: Thailand News Finder (replaces curateThailand if reliable)
// =============================================================================

export const findThailandNews = internalAction({
    args: {},
    handler: async (ctx): Promise<{ success: boolean; sourcesFound: number; articlesInserted: number; error?: string }> => {
        console.log("🇹🇭 [THAILAND DEEP RESEARCH] Finding credible news sources...");

        // Get existing URLs to avoid duplicates
        const existing = await ctx.runQuery(internal.api.getExistingTitlesInternal, { country: "thailand" });
        const existingUrls = new Set(existing.map((a: { sourceUrl: string }) => a.sourceUrl?.toLowerCase()));

        const researchQuery = `You are a senior intelligence analyst monitoring the Thailand-Cambodia border situation.

Research and compile comprehensive news coverage about Thailand-Cambodia border tensions, military activities, and diplomatic relations.

PRIORITY SOURCES (Thai perspective):
- Bangkok Post (bangkokpost.com)
- The Nation Thailand (nationthailand.com)
- Thai PBS World (thaipbsworld.com)
- Khaosod English (khaosodenglish.com)
- Thai Ministry of Foreign Affairs (mfa.go.th)
- Royal Thai Army official statements
- Reuters, AP News, AFP coverage from Thai angle

TOPICS TO COVER:
• Military movements, troop deployments, border patrols
• Government statements, ministerial comments
• Diplomatic negotiations, bilateral talks
• Civilian impact, refugees, humanitarian situation
• Historical context and recent escalations

Search thoroughly. Find all credible, recent articles with verifiable sources.
ALWAYS use English numerals (0-9). NEVER use Khmer/Thai numerals.`;

        try {
            // Use extractSources=true to get the sources list from Deep Research
            const response = await callGhostDeepResearch(researchQuery, true);

            // Parse the sources array
            let sources: Array<{ domain: string; title: string; url: string }>;
            try {
                sources = JSON.parse(response);
            } catch {
                console.log("❌ [THAILAND] Failed to parse sources JSON");
                return { success: false, sourcesFound: 0, articlesInserted: 0, error: "Invalid sources response" };
            }

            console.log(`� [THAILAND] Deep Research found ${sources.length} sources`);

            let insertedCount = 0;
            for (const source of sources) {
                // Skip duplicates by URL
                if (existingUrls.has(source.url?.toLowerCase())) {
                    console.log(`   ⏭️ Skipping duplicate URL: ${source.domain}`);
                    continue;
                }

                // Skip if missing required fields
                if (!source.title || !source.url) {
                    console.log(`   ⚠️ Skipping source with missing fields`);
                    continue;
                }

                // Determine category based on keywords
                let category: "military" | "political" | "humanitarian" | "diplomatic" = "political";
                const titleLower = source.title.toLowerCase();
                if (titleLower.includes("military") || titleLower.includes("army") || titleLower.includes("troop")) {
                    category = "military";
                } else if (titleLower.includes("refugee") || titleLower.includes("humanitarian")) {
                    category = "humanitarian";
                } else if (titleLower.includes("diplomat") || titleLower.includes("bilateral")) {
                    category = "diplomatic";
                }

                // Determine credibility based on domain
                let credibility = 75;
                const domain = source.domain.toLowerCase();
                if (domain.includes("reuters") || domain.includes("apnews")) {
                    credibility = 95;
                } else if (domain.includes("mfa.go.th") || domain.includes("gov.")) {
                    credibility = 90;
                } else if (domain.includes("bangkokpost") || domain.includes("nationthailand")) {
                    credibility = 85;
                }

                // Insert into database
                await ctx.runMutation(internal.api.insertArticle, {
                    perspective: "thailand",
                    title: source.title,
                    publishedAt: Date.now(),
                    sourceUrl: source.url,
                    source: source.domain,
                    category,
                    credibility,
                    summary: "",
                });

                console.log(`   ✅ Inserted: "${source.title.substring(0, 50)}..." (${source.domain})`);
                existingUrls.add(source.url.toLowerCase());
                insertedCount++;
            }

            console.log(`🇹🇭 [THAILAND] Complete: ${insertedCount}/${sources.length} sources inserted`);
            return { success: true, sourcesFound: sources.length, articlesInserted: insertedCount };

        } catch (error) {
            console.error(`❌ [THAILAND] Error:`, error);
            return { success: false, sourcesFound: 0, articlesInserted: 0, error: String(error) };
        }
    },
});

// =============================================================================
// STEP 1A: CAMBODIA NEWS CURATOR
// =============================================================================

export const curateCambodia = internalAction({
    args: {},
    handler: async (ctx): Promise<{ newArticles: number; flagged: number; error?: string }> => {
        console.log("🇰🇭 [CAMBODIA] Curating news via Ghost API...");

        // Get existing URLs to avoid duplicates (only pass URLs, not titles)
        const existing = await ctx.runQuery(internal.api.getExistingTitlesInternal, { country: "cambodia" });
        const existingUrls: string = existing.map((a: { sourceUrl: string }) => a.sourceUrl).join("\n");

        const prompt: string = `You are finding NEWS THAT CAMBODIAN CIVILIANS READ.

🇰🇭 YOUR PERSPECTIVE: You are searching for news as if you were a CAMBODIAN CITIZEN.
Find news articles that Cambodians would see on their local TV, newspapers, and news websites.
This means searching CAMBODIAN news outlets that publish news FOR Cambodians.

⛔⛔⛔ CRITICAL ANTI-HALLUCINATION RULES ⛔⛔⛔
🚫 DO NOT FABRICATE URLS - Every URL you return MUST be a real page you actually found
🚫 DO NOT GUESS URLS - If you found a news outlet but can't find the exact article URL, DO NOT RETURN IT
🚫 DO NOT INVENT ARTICLES - Only return articles you can verify exist right now
🚫 ZERO ARTICLES IS ACCEPTABLE - If you cannot find any real, verifiable articles, return an empty array
🚫 QUALITY OVER QUANTITY - 1 real article is infinitely better than 10 hallucinated ones

⚠️ WE VERIFY EVERY URL - If your URL returns 404 or doesn't match your summary, you have failed

🚨 PRIORITY: RECENT BREAKING NEWS & MAJOR DEVELOPMENTS
- Focus on news from the LAST 24-48 HOURS
- PRIORITIZE: Active fighting, casualties, evacuations, government statements, diplomatic moves
- Skip old articles or "background explainers" - we want CURRENT developments
- Breaking news > analysis pieces > opinion pieces
- If there's active conflict, that's the TOP priority

🌐 SEARCH IN MULTIPLE LANGUAGES:
- Search in KHMER: ព្រំដែនថៃ-កម្ពុជា, ជម្លោះព្រំដែន, កងទ័ពថៃ, ទំនាក់ទំនងថៃកម្ពុជា
- Search in ENGLISH: Thailand Cambodia border, Cambodia news, Khmer news
- PRIORITIZE Khmer-language sources - these are what Cambodians actually read!

🔍 YOUR TASK: Search the web for RECENT news articles about Thailand-Cambodia relations FROM CAMBODIAN NEWS SOURCES.

⚠️ CRITICAL REQUIREMENTS:
- SEARCH THE WEB - do not rely on memory
- ONLY include articles from CAMBODIAN news organizations (or international outlets covering Cambodia)
- Each article MUST have a REAL, working sourceUrl that you VERIFIED exists
- CLICK ON EACH URL before including it - if it 404s or doesn't load, DO NOT INCLUDE IT
- Do NOT fabricate URLs - if you can't find any REAL articles, return {"newArticles": [], "flaggedTitles": []}
- The summary MUST match what the actual article says - read the article before summarizing
- Focus on what Cambodian media is reporting to its own citizens

🔗 URL VALIDATION - CRITICAL:
- NEVER include URLs with "/attachment/" in them - these are image links, not articles!
- NEVER include URLs ending with image extensions (.jpg, .png, .gif, .webp)
- Use the CANONICAL article URL - check the browser address bar after the page fully loads
- If the URL redirects, use the FINAL destination URL
- Article URLs typically look like: domain.com/category/date/article-id or domain.com/news/article-slug

📺 CAMBODIAN NEWS SOURCES (these are what Cambodians read):
KHMER LANGUAGE (prioritize these!):
• Fresh News ហ្វ្រេសញូស (freshnewsasia.com) - Most popular in Cambodia
• DAP News ដាប់ញូស (dap-news.com) - Popular Khmer news
• VOD វីអូឌី (vodkhmer.news) - Voice of Democracy
• RFA Khmer វិទ្យុអាស៊ីសេរី (rfa.org/khmer) - Radio Free Asia Khmer
• Sabay News សប្បាយញូស (sabay.com.kh) - Popular portal
• Thmey Thmey ថ្មីថ្មី (thmey-thmey.com) - Khmer news
• CNC ស៊ីអិនស៊ី (cnc.com.kh) - Cambodia News Channel
• TVK ទូរទស្សន៍កម្ពុជា - National TV
• BTV ប៊ីធីវី (btv.com.kh) - Bayon TV

ENGLISH LANGUAGE:
• Phnom Penh Post (phnompenhpost.com)
• Khmer Times (khmertimeskh.com)
• Cambodia Daily (cambodiadaily.com)
• AKP - Agence Kampuchea Presse (akp.gov.kh) - Government

⛔ DUPLICATE CHECK - SKIP THESE URLs (we already have them):
${existingUrls || "(database is empty - find new articles!)"}

☝️ DO NOT return any article with a URL from the list above. Check EVERY URL you find against this list!

FOCUS:
- What is CAMBODIAN media telling its citizens about the border situation?
- Cambodian government statements and positions
- How Cambodian news frames the conflict
- Local Cambodian perspectives and concerns

📌 INCLUDE ALL NEWS - NOT JUST CREDIBLE:
- Find EVERYTHING a Cambodian citizen would see - propaganda, government press releases, viral stories, AND credible journalism
- 🏢 GOVERNMENT SOURCES ARE IMPORTANT: Official ministry statements, AKP, etc. = pure propaganda. INCLUDE them with low credibility scores!
- We score credibility separately - your job is to FIND news, not filter it
- Recent/breaking news is highest priority, regardless of credibility

CREDIBILITY SCORING - THINK CRITICALLY:
Don't just score based on source name. Analyze the CONTENT:
🔴 LOWER SCORE IF: Emotional language, no evidence cited, one-sided, exaggerated claims, "sources say" without naming who
🟢 HIGHER SCORE IF: Quotes both sides, cites specific evidence, admits uncertainty, neutral factual tone, matches international reports

SCORING GUIDE:
• 75-100: Factual, evidence-based, matches international sources, quotes multiple sides (RARE)
• 55-74: Solid reporting with working URL, mostly verifiable claims
• 40-54: Some bias or propaganda elements, needs verification
• 25-39: Heavy propaganda, emotional language, unverified, missing URL
• Below 25: Obvious misinformation or fabrication

⚠️ SUMMARY ACCURACY - CRITICAL:
- Your summary MUST match what the article ACTUALLY says - DO NOT embellish or add details
- If the article says "security reasons" - write "security reasons", NOT "due to attacks" 
- If the article doesn't mention casualties - DON'T add casualties to the summary
- QUOTE the article's actual words when possible
- DO NOT INFER or EXTRAPOLATE beyond what's written
- If unsure, keep summary SHORTER and more conservative

TRANSLATION REQUIREMENTS:
- Provide NATURAL, CONVERSATIONAL translations (not machine-translated)
- Thai: ภาษาพูด (spoken Thai) - casual everyday language like how a regular Thai person would say it to a friend
- Khmer: ភាសាប្រចាំថ្ងៃ (everyday Khmer) - casual conversational language like how a Cambodian would explain to family
- NOT formal/government language - use words regular people actually use
- ALWAYS use English numerals (0-9) - NEVER Thai ๑๒๓ or Khmer ១២៣
- If unsure about translation quality, leave field empty

OUTPUT FORMAT - Wrap your JSON in <json> tags:
<json>
{
  "newArticles": [
    {
      "title": "Original headline as published",
      "titleEn": "English translation of headline",
      "titleTh": "Thai translation: หัวข้อข่าวภาษาไทย",
      "titleKh": "Khmer translation: ចំណងជើងជាភាសាខ្មែរ",
      "publishedAt": "YYYY-MM-DDTHH:mm:ssZ",
      "sourceUrl": "https://actual-url.com/path",
      "source": "Publication Name",
      "category": "military|political|humanitarian|diplomatic",
      "credibility": 60,
      "summary": "English summary",
      "summaryEn": "English summary",
      "summaryTh": "สรุปข่าวภาษาไทย",
      "summaryKh": "សង្ខេបជាភាសាខ្មែរ"
    }
  ],
  "flaggedTitles": []
}
</json>

RULES:
- You MUST include <json> and </json> tags
- Inside the tags, output valid JSON only
- Use English numerals (0-9) only

📝 IMPORTANT - LIST ARTICLES BEFORE JSON:
Before outputting your JSON, you MUST first list each article you found in a numbered format.
This helps you keep track and avoid mixing up URLs/titles/summaries between articles.

Example format (put this BEFORE the <json> tags):
---
ARTICLES FOUND:
1. [Fresh News] "Hun Manet appeals to UN" - https://freshnewsasia.com/xxxxx
   → About: Cambodia's PM asking UN for intervention
   → Date: Dec 13, 2025

2. [Khmer Times] "Border clashes continue" - https://khmertimes.com/yyyyy
   → About: Fighting in Pursat province
   → Date: Dec 13, 2025

3. (none found that are new/relevant)
---
<json>
{ ... your JSON here, matching the list above ... }
</json>

⚠️ DOUBLE-CHECK: Before outputting JSON, verify that each article's URL matches its title and summary.
Do NOT mix up Article 1's URL with Article 2's summary!

✅ IT IS OK TO RETURN ZERO ARTICLES:
- If you searched and found nothing relevant, return: <json>{"newArticles": [], "flaggedTitles": []}</json>
- This is GOOD behavior - we prefer 0 real articles over any hallucinated ones
- Do NOT feel pressured to fill the array - empty is fine!

📅 DATE HANDLING - BE STRICT, DON'T GUESS:
- ONLY provide \"publishedAt\" if you find an EXPLICIT date on the page (e.g., \"Published: Dec 13, 2025\", \"2025-12-13\")
- If the date is UNCLEAR or you're UNCERTAIN, set \"publishedAt\": null - WE WILL USE FETCH TIME
- DO NOT guess based on \"yesterday\", \"recently\", \"this week\" - set null instead
- DO NOT use today's date unless the article explicitly says \"Published today\" with a date
- Common bad dates to REJECT: dates in the far future, dates from years ago for current news
- Format if you DO find a date: \"YYYY-MM-DDTHH:mm:ssZ\" or \"YYYY-MM-DD\"
- WHEN IN DOUBT, USE NULL - bad dates corrupt our timeline system

🔴 FINAL CHECK BEFORE RESPONDING:
For EACH article in your response, ask yourself:
1. Did I actually visit this URL and see it load? If NO → remove it
2. Does my summary match what the page actually says? If NO → remove it
3. Is this about Thailand-Cambodia relations? If NO → remove it

If no news found: <json>{"newArticles": [], "flaggedTitles": []}</json>`;

        return await processNewsResponse(ctx, prompt, "cambodia");
    },
});

// =============================================================================
// STEP 1B: THAILAND NEWS CURATOR
// =============================================================================

export const curateThailand = internalAction({
    args: {},
    handler: async (ctx): Promise<{ newArticles: number; flagged: number; error?: string }> => {
        console.log("🇹🇭 [THAILAND] Curating news via Ghost API...");

        // Get existing URLs to avoid duplicates (only pass URLs, not titles)
        const existing = await ctx.runQuery(internal.api.getExistingTitlesInternal, { country: "thailand" });
        const existingUrls: string = existing.map((a: { sourceUrl: string }) => a.sourceUrl).join("\n");

        const prompt: string = `You are finding NEWS THAT THAI CIVILIANS READ.

🇹🇭 YOUR PERSPECTIVE: You are searching for news as if you were a THAI CITIZEN.
Find news articles that Thais would see on their local TV, newspapers, and news websites.
This means searching THAI news outlets that publish news FOR Thai people.

⛔⛔⛔ CRITICAL ANTI-HALLUCINATION RULES ⛔⛔⛔
🚫 DO NOT FABRICATE URLS - Every URL you return MUST be a real page you actually found
🚫 DO NOT GUESS URLS - If you found a news outlet but can't find the exact article URL, DO NOT RETURN IT
🚫 DO NOT INVENT ARTICLES - Only return articles you can verify exist right now
🚫 ZERO ARTICLES IS ACCEPTABLE - If you cannot find any real, verifiable articles, return an empty array
🚫 QUALITY OVER QUANTITY - 1 real article is infinitely better than 10 hallucinated ones

⚠️ WE VERIFY EVERY URL - If your URL returns 404 or doesn't match your summary, you have failed

🚨 PRIORITY: RECENT BREAKING NEWS & MAJOR DEVELOPMENTS
- Focus on news from the LAST 24-48 HOURS
- PRIORITIZE: Active fighting, casualties, evacuations, government statements, diplomatic moves
- Skip old articles or "background explainers" - we want CURRENT developments
- Breaking news > analysis pieces > opinion pieces
- If there's active conflict, that's the TOP priority

🌐 SEARCH IN MULTIPLE LANGUAGES:
- Search in THAI: ชายแดนไทย-กัมพูชา, ข่าวชายแดน, ทหารไทย, ความสัมพันธ์ไทยกัมพูชา, ปราสาทพระวิหาร
- Search in ENGLISH: Thailand Cambodia border, Thai news, Bangkok Post
- PRIORITIZE Thai-language sources - these are what Thai people actually read!

🔍 YOUR TASK: Search the web for RECENT news articles about Thailand-Cambodia relations FROM THAI NEWS SOURCES.

⚠️ CRITICAL REQUIREMENTS:
- SEARCH THE WEB - do not rely on memory
- ONLY include articles from THAI news organizations (or international outlets covering Thailand)
- Each article MUST have a REAL, working sourceUrl that you VERIFIED exists
- CLICK ON EACH URL before including it - if it 404s or doesn't load, DO NOT INCLUDE IT
- Do NOT fabricate URLs - if you can't find any REAL articles, return {"newArticles": [], "flaggedTitles": []}
- The summary MUST match what the actual article says - read the article before summarizing
- Focus on what Thai media is reporting to its own citizens

🔗 URL VALIDATION - CRITICAL:
- NEVER include URLs with "/attachment/" in them - these are image links, not articles!
- NEVER include URLs ending with image extensions (.jpg, .png, .gif, .webp)
- Use the CANONICAL article URL - check the browser address bar after the page fully loads
- If the URL redirects, use the FINAL destination URL
- Article URLs typically look like: domain.com/category/date/article-id or domain.com/news/article-slug

📺 THAI NEWS SOURCES (these are what Thais read):
THAI LANGUAGE (prioritize these!):
• ไทยรัฐ Thai Rath (thairath.co.th) - #1 largest circulation in Thailand
• เดลินิวส์ Daily News (dailynews.co.th) - Major Thai daily
• มติชน Matichon (matichon.co.th) - Quality Thai newspaper
• ข่าวสด Khaosod (khaosod.co.th) - Popular Thai news
• คมชัดลึก Kom Chad Luek (komchadluek.net) - Thai news
• PPTV HD 36 (pptvhd36.com) - Thai TV channel
• ช่อง 3 Channel 3 (ch3thailand.com) - Major Thai TV
• ช่อง 7 Channel 7 (ch7.com) - Major Thai TV  
• Thai PBS ไทยพีบีเอส (thaipbs.or.th) - Public broadcaster
• กรุงเทพธุรกิจ (bangkokbiznews.com) - Business news
• ผู้จัดการ Manager (mgronline.com) - Thai news portal

ENGLISH LANGUAGE:
• Bangkok Post (bangkokpost.com) - Oldest English daily
• The Nation Thailand (nationthailand.com)
• Thai PBS World (thaipbsworld.com)
• Khaosod English (khaosodenglish.com)

⛔ DUPLICATE CHECK - SKIP THESE URLs (we already have them):
${existingUrls || "(database is empty - find new articles!)"}

☝️ DO NOT return any article with a URL from the list above. Check EVERY URL you find against this list!

FOCUS:
- What is THAI media telling its citizens about the border situation?
- Thai government statements and positions
- How Thai news frames the conflict
- Local Thai perspectives and concerns

📌 INCLUDE ALL NEWS - NOT JUST CREDIBLE:
- Find EVERYTHING a Thai citizen would see - propaganda, government press releases, viral stories, AND credible journalism
- 🏢 GOVERNMENT SOURCES ARE IMPORTANT: Official military statements, ministry announcements = pure propaganda. INCLUDE them with low credibility scores!
- We score credibility separately - your job is to FIND news, not filter it
- Recent/breaking news is highest priority, regardless of credibility

CREDIBILITY SCORING - THINK CRITICALLY:
Don't just score based on source name. Analyze the CONTENT:
🔴 LOWER SCORE IF: Emotional language, no evidence cited, one-sided, exaggerated claims, "sources say" without naming who
🟢 HIGHER SCORE IF: Quotes both sides, cites specific evidence, admits uncertainty, neutral factual tone, matches international reports

• 75-100: Factual, evidence-based, matches international sources, quotes multiple sides (RARE)
• 55-74: Solid reporting with working URL, mostly verifiable claims
• 40-54: Some bias or propaganda elements, needs verification
• 25-39: Heavy propaganda, emotional language, unverified, missing URL
• Below 25: Obvious misinformation or fabrication

⚠️ SUMMARY ACCURACY - CRITICAL:
- Your summary MUST match what the article ACTUALLY says - DO NOT embellish or add details
- If the article says "security reasons" - write "security reasons", NOT "due to attacks" 
- If the article doesn't mention casualties - DON'T add casualties to the summary
- QUOTE the article's actual words when possible
- DO NOT INFER or EXTRAPOLATE beyond what's written
- If unsure, keep summary SHORTER and more conservative

TRANSLATION REQUIREMENTS:
- Provide NATURAL, CONVERSATIONAL translations (not machine-translated)
- Thai: ภาษาพูด (spoken Thai) - casual everyday language like how a regular Thai person would say it to a friend
- Khmer: ភាសាប្រចាំថ្ងៃ (everyday Khmer) - casual conversational language like how a Cambodian would explain to family
- NOT formal/government language - use words regular people actually use
- ALWAYS use English numerals (0-9) - NEVER Thai ๑๒๓ or Khmer ១២៣
- If unsure about translation quality, leave field empty

OUTPUT FORMAT - Wrap your JSON in <json> tags:
<json>
{
  "newArticles": [
    {
      "title": "Original headline as published",
      "titleEn": "English translation of headline",
      "titleTh": "Thai translation: หัวข้อข่าวภาษาไทย",
      "titleKh": "Khmer translation: ចំណងជើងជាភាសាខ្មែរ",
      "publishedAt": "YYYY-MM-DDTHH:mm:ssZ",
      "sourceUrl": "https://actual-url.com/path",
      "source": "Publication Name",
      "category": "military|political|humanitarian|diplomatic",
      "credibility": 60,
      "summary": "English summary",
      "summaryEn": "English summary",
      "summaryTh": "สรุปข่าวภาษาไทย",
      "summaryKh": "សង្ខេបជាភាសាខ្មែរ"
    }
  ],
  "flaggedTitles": []
}
</json>

RULES:
- You MUST include <json> and </json> tags
- Inside the tags, output valid JSON only
- Use English numerals (0-9) only

📝 IMPORTANT - LIST ARTICLES BEFORE JSON:
Before outputting your JSON, you MUST first list each article you found in a numbered format.
This helps you keep track and avoid mixing up URLs/titles/summaries between articles.

Example format (put this BEFORE the <json> tags):
---
ARTICLES FOUND:
1. [Thai Rath] "ทภ.2 สรุปปะทะชายแดน" - https://thairath.co.th/xxxxx
   → About: Army Region 2 reports on border clashes
   → Date: Dec 13, 2025

2. [Bangkok Post] "PM rejects ceasefire claims" - https://bangkokpost.com/yyyyy
   → About: Thai PM denies Trump's ceasefire announcement
   → Date: Dec 13, 2025

3. (none found that are new/relevant)
---
<json>
{ ... your JSON here, matching the list above ... }
</json>

⚠️ DOUBLE-CHECK: Before outputting JSON, verify that each article's URL matches its title and summary.
Do NOT mix up Article 1's URL with Article 2's summary!

✅ IT IS OK TO RETURN ZERO ARTICLES:
- If you searched and found nothing relevant, return: <json>{"newArticles": [], "flaggedTitles": []}</json>
- This is GOOD behavior - we prefer 0 real articles over any hallucinated ones
- Do NOT feel pressured to fill the array - empty is fine!

📅 DATE HANDLING - BE STRICT, DON'T GUESS:
- ONLY provide \"publishedAt\" if you find an EXPLICIT date on the page (e.g., \"Published: Dec 13, 2025\", \"2025-12-13\")
- If the date is UNCLEAR or you're UNCERTAIN, set \"publishedAt\": null - WE WILL USE FETCH TIME
- DO NOT guess based on \"yesterday\", \"recently\", \"this week\" - set null instead
- DO NOT use today's date unless the article explicitly says \"Published today\" with a date
- Common bad dates to REJECT: dates in the far future, dates from years ago for current news
- Format if you DO find a date: \"YYYY-MM-DDTHH:mm:ssZ\" or \"YYYY-MM-DD\"
- WHEN IN DOUBT, USE NULL - bad dates corrupt our timeline system

🔴 FINAL CHECK BEFORE RESPONDING:
For EACH article in your response, ask yourself:
1. Did I actually visit this URL and see it load? If NO → remove it
2. Does my summary match what the page actually says? If NO → remove it
3. Is this about Thailand-Cambodia relations? If NO → remove it

If no news found: <json>{"newArticles": [], "flaggedTitles": []}</json>`;

        return await processNewsResponse(ctx, prompt, "thailand");
    },
});

// =============================================================================
// STEP 1C: INTERNATIONAL NEWS CURATOR (3rd party sources)
// =============================================================================

export const curateInternational = internalAction({
    args: {},
    handler: async (ctx): Promise<{ newArticles: number; flagged: number; error?: string }> => {
        console.log("🌍 [INTERNATIONAL] Curating news via Ghost API...");

        // Get existing URLs to avoid duplicates (only pass URLs, not titles)
        const existing = await ctx.runQuery(internal.api.getExistingTitlesInternal, { country: "international" });
        const existingUrls: string = existing.map((a: { sourceUrl: string }) => a.sourceUrl).join("\n");

        const prompt: string = `You are finding INTERNATIONAL/NEUTRAL NEWS about the Thailand-Cambodia situation.

🌍 YOUR PERSPECTIVE: You are an OUTSIDE OBSERVER - not Thai, not Cambodian.
Find news from international wire services and global news outlets.
These sources should provide NEUTRAL, BALANCED reporting without favoring either side.

⛔⛔⛔ CRITICAL ANTI-HALLUCINATION RULES ⛔⛔⛔
🚫 DO NOT FABRICATE URLS - Every URL you return MUST be a real page you actually found
🚫 DO NOT GUESS URLS - If you found a news outlet but can't find the exact article URL, DO NOT RETURN IT
🚫 DO NOT INVENT ARTICLES - Only return articles you can verify exist right now
🚫 ZERO ARTICLES IS ACCEPTABLE - If you cannot find any real, verifiable articles, return an empty array
🚫 QUALITY OVER QUANTITY - 1 real article is infinitely better than 10 hallucinated ones

⚠️ WE VERIFY EVERY URL - If your URL returns 404 or doesn't match your summary, you have failed

🚨 PRIORITY: RECENT BREAKING NEWS & MAJOR DEVELOPMENTS
- Focus on news from the LAST 24-48 HOURS
- PRIORITIZE: Active fighting, casualties, evacuations, international reactions, diplomatic interventions
- Wire services (Reuters, AP, AFP) are your BEST sources for breaking news
- Skip old articles - we want what's happening NOW
- If there's active conflict, that's the TOP priority

🌐 SEARCH IN ENGLISH (primary international language):
- Search: Thailand Cambodia border conflict, Thailand Cambodia tensions, Southeast Asia border dispute
- Focus on WIRE SERVICES and GLOBAL NEWS OUTLETS
- Avoid Thai or Cambodian domestic news - that's for the other curators

🔍 YOUR TASK: Search the web for RECENT, NEUTRAL, INTERNATIONAL news articles about Thailand-Cambodia.

⚠️ CRITICAL REQUIREMENTS:
- SEARCH THE WEB - do not rely on memory
- ONLY use INTERNATIONAL sources (NOT Thai or Cambodian domestic outlets)
- Each article MUST have a REAL, working sourceUrl that you VERIFIED exists
- CLICK ON EACH URL before including it - if it 404s or doesn't load, DO NOT INCLUDE IT
- Do NOT fabricate URLs - if you can't find any REAL articles, return {"newArticles": [], "flaggedTitles": []}
- The summary MUST match what the actual article says - read the article before summarizing
- Focus on NEUTRAL, OBJECTIVE reporting

🔗 URL VALIDATION - CRITICAL:
- NEVER include URLs with "/attachment/" in them - these are image links, not articles!
- NEVER include URLs ending with image extensions (.jpg, .png, .gif, .webp)
- Use the CANONICAL article URL - check the browser address bar after the page fully loads
- If the URL redirects, use the FINAL destination URL
- Article URLs typically look like: domain.com/category/date/article-id or domain.com/news/article-slug

📺 INTERNATIONAL SOURCES (prioritize these):
WIRE SERVICES (highest credibility):
• Reuters (reuters.com) - HIGHEST priority
• Associated Press / AP News (apnews.com)
• AFP / Agence France-Presse (france24.com)

GLOBAL NEWS OUTLETS:
• BBC (bbc.com) - British
• Al Jazeera (aljazeera.com) - Qatar-based
• CNN International (cnn.com)
• The Guardian (theguardian.com)
• DW Deutsche Welle (dw.com) - German

ASIA-FOCUSED INTERNATIONAL:
• The Diplomat (thediplomat.com) - Asia analysis
• Nikkei Asia (asia.nikkei.com) - Japanese-owned
• South China Morning Post (scmp.com) - HK-based
• Channel News Asia (channelnewsasia.com) - Singapore
• Voice of America (voanews.com)

OFFICIAL INTERNATIONAL:
• UN News (news.un.org)
• ASEAN official statements

⛔ DUPLICATE CHECK - SKIP THESE URLs (we already have them):
${existingUrls || "(database is empty - find new articles!)"}

☝️ DO NOT return any article with a URL from the list above. Check EVERY URL you find against this list!

FOCUS:
- Neutral, fact-based reporting
- International community reactions (UN, ASEAN, US, China, Japan)
- Verified casualty figures and humanitarian impact
- Diplomatic efforts and negotiations
- What the OUTSIDE WORLD is being told about this conflict

📌 INCLUDE ALL NEWS - EVEN BIASED INTERNATIONAL COVERAGE:
- Find EVERYTHING international outlets are reporting - including sensationalized or biased coverage
- We score credibility separately - your job is to FIND news, not filter it
- Recent/breaking news is highest priority, regardless of credibility

CREDIBILITY SCORING - THINK CRITICALLY:
Don't just score based on source name. Analyze the CONTENT:
🔴 LOWER SCORE IF: Emotional language, unverified claims, sensational headlines, "sources say" without naming who
🟢 HIGHER SCORE IF: Quotes officials from both countries, cites specific evidence, admits uncertainty, neutral factual tone

SCORING GUIDE:
• 85-100: Factual, evidence-based, quotes multiple sides, verifiable claims (this is your baseline for international)
• 70-84: Solid reporting, mostly balanced, working URL
• 55-69: Some bias or gaps, needs cross-checking
• 40-54: Questionable claims, missing verification
• Below 40: Unreliable, missing URL, contradicted by other sources

⚠️ SUMMARY ACCURACY - CRITICAL:
- Your summary MUST match what the article ACTUALLY says - DO NOT embellish or add details
- If the article says "security reasons" - write "security reasons", NOT "due to attacks" 
- If the article doesn't mention casualties - DON'T add casualties to the summary
- QUOTE the article's actual words when possible
- DO NOT INFER or EXTRAPOLATE beyond what's written
- If unsure, keep summary SHORTER and more conservative

TRANSLATION REQUIREMENTS:
- Provide NATURAL, CONVERSATIONAL translations (not machine-translated)
- Thai: ภาษาพูด (spoken Thai) - casual everyday language
- Khmer: ភាសាប្រចាំថ្ងៃ (everyday Khmer) - casual conversational language
- ALWAYS use English numerals (0-9) - NEVER Thai ๑๒๓ or Khmer ១២៣
- If unsure about translation quality, leave field empty

OUTPUT FORMAT - Wrap your JSON in <json> tags:
<json>
{
  "newArticles": [
    {
      "title": "Original headline as published",
      "titleEn": "English translation of headline",
      "titleTh": "Thai translation: หัวข้อข่าวภาษาไทย",
      "titleKh": "Khmer translation: ចំណងជើងជាភាសាខ្មែរ",
      "publishedAt": "YYYY-MM-DDTHH:mm:ssZ",
      "sourceUrl": "https://actual-url.com/path",
      "source": "Publication Name",
      "category": "military|political|humanitarian|diplomatic",
      "credibility": 85,
      "summary": "English summary",
      "summaryEn": "English summary",
      "summaryTh": "สรุปข่าวภาษาไทย",
      "summaryKh": "សង្ខេបជាភាសាខ្មែរ"
    }
  ],
  "flaggedTitles": []
}
</json>

RULES:
- You MUST include <json> and </json> tags
- Inside the tags, output valid JSON only
- Use English numerals (0-9) only

📝 IMPORTANT - LIST ARTICLES BEFORE JSON:
Before outputting your JSON, you MUST first list each article you found in a numbered format.
This helps you keep track and avoid mixing up URLs/titles/summaries between articles.

Example format (put this BEFORE the <json> tags):
---
ARTICLES FOUND:
1. [Reuters] "Thailand-Cambodia clashes continue" - https://reuters.com/xxxxx
   → About: Wire service report on ongoing border conflict
   → Date: Dec 13, 2025

2. [AP News] "UN calls for immediate ceasefire" - https://apnews.com/yyyyy
   → About: UN Secretary-General's statement
   → Date: Dec 13, 2025

3. (none found that are new/relevant)
---
<json>
{ ... your JSON here, matching the list above ... }
</json>

⚠️ DOUBLE-CHECK: Before outputting JSON, verify that each article's URL matches its title and summary.
Do NOT mix up Article 1's URL with Article 2's summary!

✅ IT IS OK TO RETURN ZERO ARTICLES:
- If you searched and found nothing relevant, return: <json>{"newArticles": [], "flaggedTitles": []}</json>
- This is GOOD behavior - we prefer 0 real articles over any hallucinated ones
- Do NOT feel pressured to fill the array - empty is fine!

📅 DATE HANDLING - BE STRICT, DON'T GUESS:
- ONLY provide \"publishedAt\" if you find an EXPLICIT date on the page (e.g., \"Published: Dec 13, 2025\", \"2025-12-13\")
- If the date is UNCLEAR or you're UNCERTAIN, set \"publishedAt\": null - WE WILL USE FETCH TIME
- DO NOT guess based on \"yesterday\", \"recently\", \"this week\" - set null instead
- DO NOT use today's date unless the article explicitly says \"Published today\" with a date
- Common bad dates to REJECT: dates in the far future, dates from years ago for current news
- Format if you DO find a date: \"YYYY-MM-DDTHH:mm:ssZ\" or \"YYYY-MM-DD\"
- WHEN IN DOUBT, USE NULL - bad dates corrupt our timeline system

🔴 FINAL CHECK BEFORE RESPONDING:
For EACH article in your response, ask yourself:
1. Did I actually visit this URL and see it load? If NO → remove it
2. Does my summary match what the page actually says? If NO → remove it
3. Is this about Thailand-Cambodia relations? If NO → remove it

If no news found: <json>{"newArticles": [], "flaggedTitles": []}</json>`;

        return await processNewsResponse(ctx, prompt, "international");
    },
});

// Shared helper to process Ghost API response and save articles
async function processNewsResponse(
    ctx: any,
    prompt: string,
    country: "thailand" | "cambodia" | "international"
): Promise<{ newArticles: number; flagged: number; error?: string }> {
    let lastError: any;
    const MAX_RETRIES = 3;

    let currentPrompt = prompt;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        let rawResponse = "";

        try {
            console.log(`🤖 [${country.toUpperCase()}] Attempt ${attempt}/${MAX_RETRIES} (Model: fast)...`);

            // 1. CALL API - Always use fast model for curation
            rawResponse = await callGhostAPI(currentPrompt, "fast", 1);

            // 2. EXTRACT JSON - Try <json> tags first, then fallback to regex
            let jsonStr: string | null = null;

            // Method 1: Look for <json>...</json> tags (preferred)
            const tagMatch = rawResponse.match(/<json>([\s\S]*?)<\/json>/i);
            if (tagMatch) {
                jsonStr = tagMatch[1].trim();
                console.log(`✅ [${country.toUpperCase()}] Extracted JSON from <json> tags`);
            } else {
                // Method 2: Fallback - strip markdown first, then find { to }
                const cleanedResponse = rawResponse
                    .replace(/```json\s*/g, "").replace(/```\s*/g, "")
                    .trim();
                const firstOpen = cleanedResponse.indexOf('{');
                const lastClose = cleanedResponse.lastIndexOf('}');
                if (firstOpen !== -1 && lastClose !== -1) {
                    jsonStr = cleanedResponse.substring(firstOpen, lastClose + 1);
                }
            }

            if (!jsonStr) {
                throw new Error("No JSON object found in response");
            }

            // MINIMAL JSON CLEANUP (don't break Thai/Khmer text!)
            // 1. Remove control characters (except newline, tab, carriage return)
            jsonStr = jsonStr.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

            // 2. Fix markdown-formatted URLs: "[text](url)" -> "url"
            jsonStr = jsonStr.replace(/"\[([^\]]*)\]\(([^)]+)\)"/g, '"$2"');

            // 3. Remove trailing commas before ] or }
            jsonStr = jsonStr.replace(/,\s*([\]\}])/g, '$1');

            // 4. Remove any BOM or zero-width characters
            jsonStr = jsonStr.replace(/[\uFEFF\u200B\u200C\u200D]/g, '');

            // NOTE: We intentionally do NOT replace curly quotes - they're valid in Thai/Khmer titles

            // 3. PARSE
            let result;
            try {
                result = JSON.parse(jsonStr);
            } catch (parseError: any) {
                console.log(`⚠️ [${country.toUpperCase()}] JSON Parse Error on attempt ${attempt}: ${parseError.message}`);

                if (attempt < MAX_RETRIES) {
                    console.log(`🔄 [${country.toUpperCase()}] Constructing repair prompt for next attempt...`);

                    currentPrompt = `Your previous response had invalid JSON. Please fix it.

--- ORIGINAL TASK ---
${prompt}
--- END TASK ---

--- YOUR BROKEN RESPONSE ---
${rawResponse.substring(0, 2000)}${rawResponse.length > 2000 ? '...(truncated)' : ''}
--- END RESPONSE ---

--- ERROR ---
${parseError.message}
---

Please output the FIXED JSON wrapped in <json> tags:
<json>
{"newArticles": [...], "flaggedTitles": []}
</json>`;

                    continue; // Loop to next attempt with new prompt
                } else {
                    throw parseError; // Give up
                }
            }

            // 5. SUCCESS - PROCESS ARTICLES
            // (Same helper logic as before for validating URLs/inserting)

            // ... (Insert Logic) ...
            let addedCount = 0;
            let skippedCount = 0;

            // Normalize "newArticles" - sometimes models return just the array, or wrap it differently
            const articles = Array.isArray(result) ? result : (result.newArticles || []);

            // Insert new articles
            for (const article of articles) {
                // VALIDATE and PARSE publishedAt - fall back to fetch time if invalid/missing
                let publishedAt = Date.now(); // Default to fetch time
                if (article.publishedAt && article.publishedAt !== null) {
                    const parsed = new Date(article.publishedAt).getTime();
                    if (!isNaN(parsed)) {
                        // Validate: not in the future, not more than 30 days old
                        const now = Date.now();
                        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
                        const oneDayInFuture = now + (24 * 60 * 60 * 1000);

                        if (parsed > oneDayInFuture) {
                            console.log(`   ⚠️ Rejecting future date for "${article.title?.substring(0, 30)}..." - using fetch time`);
                        } else if (parsed < thirtyDaysAgo) {
                            console.log(`   ⚠️ Rejecting old date (>30 days) for "${article.title?.substring(0, 30)}..." - using fetch time`);
                        } else {
                            publishedAt = parsed; // Valid date, use it
                        }
                    }
                }

                // ====== URL VALIDATION ======
                const url = article.sourceUrl || "";
                let credibilityPenalty = 0;

                // Check URL format
                if (!url || url.length < 10) {
                    console.log(`   ⚠️ Skipping "${article.title?.substring(0, 40)}..." - missing URL`);
                    skippedCount++;
                    continue;
                }

                // Basic URL validation
                try {
                    const parsed = new URL(url);
                    // Check for suspicious patterns
                    if (parsed.hostname.includes("example.com") ||
                        parsed.hostname.includes("fake") ||
                        parsed.hostname.includes("test") ||
                        parsed.hostname.length < 4) {
                        console.log(`   ⚠️ Skipping suspicious URL: ${url}`);
                        skippedCount++;
                        continue;
                    }
                    // Penalize non-HTTPS (less credible)
                    if (parsed.protocol !== "https:") {
                        credibilityPenalty += 5;
                    }
                } catch {
                    console.log(`   ⚠️ Skipping invalid URL format: ${url}`);
                    skippedCount++;
                    continue;
                }

                // Check for AI-generated fake URL patterns
                const suspiciousPatterns = [
                    /\/article\/\d{10,}/, // Suspiciously long numeric IDs
                    /\/news\/[a-f0-9]{32}/, // Random hex strings
                    /example\.com/,
                    /placeholder/,
                    /lorem/,
                ];
                for (const pattern of suspiciousPatterns) {
                    if (pattern.test(url)) {
                        credibilityPenalty += 15;
                        console.log(`   ⚠️ URL looks AI-generated, reducing credibility: ${url.substring(0, 50)}...`);
                        break;
                    }
                }

                // Validate category - default to "political" if invalid
                const validCategories = ["military", "political", "humanitarian", "diplomatic"];
                const category = validCategories.includes(article.category) ? article.category : "political";

                // Apply credibility penalty
                const finalCredibility = Math.max(10, Math.min(100, (article.credibility || 50) - credibilityPenalty));

                // Check if insert was successful (returns null if duplicate)
                const insertResult = await ctx.runMutation(internal.api.insertArticle, {
                    perspective: country,
                    title: article.title,
                    titleEn: article.titleEn,
                    titleTh: article.titleTh,
                    titleKh: article.titleKh,
                    publishedAt,
                    sourceUrl: url,
                    source: article.source,
                    category,
                    credibility: finalCredibility,
                    summary: article.summary,
                    summaryEn: article.summaryEn,
                    summaryTh: article.summaryTh,
                    summaryKh: article.summaryKh,
                });

                if (insertResult !== null) {
                    // Actually inserted
                    addedCount++;
                    const credNote = credibilityPenalty > 0 ? ` (adjusted from ${article.credibility || 50})` : "";
                    console.log(`   ✅ Added: "${(article.titleEn || article.title || "").substring(0, 50)}..." [${finalCredibility}${credNote}]`);
                } else {
                    // Skipped as duplicate
                    skippedCount++;
                }
            }

            if (skippedCount > 0) {
                console.log(`   ⚠️ Skipped ${skippedCount} duplicates/invalid URLs`);
            }

            // Flag outdated articles
            for (const title of result.flaggedTitles || []) {
                await ctx.runMutation(internal.api.flagArticle, {
                    title,
                    status: "outdated",
                    country,
                });
            }

            console.log(`✅ [${country.toUpperCase()}] Added ${addedCount}, skipped ${skippedCount}, flagged ${(result.flaggedTitles || []).length}`);
            return { newArticles: addedCount, flagged: (result.flaggedTitles || []).length };

        } catch (err: any) {
            lastError = err;
            console.error(`❌ [${country.toUpperCase()}] Attempt ${attempt} failed: ${err.message}`);
            // If it was a network error (not a JSON parse error which is handled in inner catch), we loop here.
            // But we didn't change the prompt, so a simple retry might work if it was transient.
        }
    }

    // If we get here, all retries failed
    return { newArticles: 0, flagged: 0, error: String(lastError) };
}

// =============================================================================
// STEP 2: COMBINED SYNTHESIS (1 Ghost API call for all 3 analyses)
// =============================================================================

export const synthesizeAll = internalAction({
    args: {},
    handler: async (ctx): Promise<any> => {
        console.log("🧠 [SYNTHESIS] Running combined analysis via Ghost API...");

        // ==================== TIMELINE CONTEXT (PRIMARY SOURCE) ====================
        // Timeline events are the verified, structured "memory" of the conflict
        const timeline = await ctx.runQuery(internal.api.getRecentTimeline, { limit: 50 });
        const timelineStats = await ctx.runQuery(internal.api.getTimelineStats, {});

        console.log(`📜 Timeline: ${timeline.length} events (avg importance: ${timelineStats.avgImportance})`);

        const timelineContext = timeline.length > 0
            ? timeline.map((e: any) => {
                const timeDisplay = e.timeOfDay ? `, ${e.timeOfDay}` : "";
                // Get top 3 most credible sources with URLs for verification (matching historian.ts)
                const topSources = [...e.sources]
                    .sort((a: any, b: any) => (b.credibility || 50) - (a.credibility || 50))
                    .slice(0, 3);
                const sourceDetails = topSources
                    .map((s: any) => `${s.name} (cred:${s.credibility || 50}): ${s.url}`)
                    .join("\n     ");
                return `[${e.date}${timeDisplay}] ${e.title} (${e.category}, ${e.status}, importance:${e.importance})
   ${e.description}
   Sources (${e.sources.length} total, top 3):
     ${sourceDetails || "(none)"}`;
            }).join("\n\n")
            : "(No timeline events yet - first run)";

        // ==================== STRATIFIED ARTICLE SAMPLING ====================
        // Timeline has verified/credible sources, so we DON'T need high-cred articles again.
        // Instead we focus on:
        // 1. LOW CREDIBILITY (propaganda) - to analyze what each side is lying about
        // 2. BREAKING NEWS (most recent) - to catch current developments
        // This keeps context bounded even as DB grows to 1000s of articles.

        // Fetch more articles than we need, then filter
        const cambodiaAll: any[] = await ctx.runQuery(internal.api.getNewsInternal, { country: "cambodia", limit: 100 });
        const thailandAll: any[] = await ctx.runQuery(internal.api.getNewsInternal, { country: "thailand", limit: 100 });
        const internationalAll: any[] = await ctx.runQuery(internal.api.getNewsInternal, { country: "international", limit: 100 });

        if (cambodiaAll.length === 0 && thailandAll.length === 0 && internationalAll.length === 0 && timeline.length === 0) {
            console.log("⚠️ [SYNTHESIS] No articles or timeline events to synthesize");
            return null;
        }

        // Helper to format article for prompt - numbered for better AI tracking
        const formatArticle = (a: any, idx: number) =>
            `${idx + 1}. [${a.category}] "${a.title}" (${a.source}, cred:${a.credibility || 50})
   URL: ${a.sourceUrl || "(none)"}
   Summary: ${a.summary || "No summary"}`;

        // ==================== LOW CREDIBILITY / PROPAGANDA (15 per country) ====================
        // Sort by credibility ASC (lowest first) and take 15
        const cambodiaLowCred = [...cambodiaAll]
            .sort((a, b) => (a.credibility || 50) - (b.credibility || 50))
            .slice(0, 15);
        const thailandLowCred = [...thailandAll]
            .sort((a, b) => (a.credibility || 50) - (b.credibility || 50))
            .slice(0, 15);
        const internationalLowCred = [...internationalAll]
            .sort((a, b) => (a.credibility || 50) - (b.credibility || 50))
            .slice(0, 15);

        const cambodiaPropaganda = cambodiaLowCred.map((a, i) => formatArticle(a, i)).join("\n");
        const thailandPropaganda = thailandLowCred.map((a, i) => formatArticle(a, i)).join("\n");
        const internationalPropaganda = internationalLowCred.map((a, i) => formatArticle(a, i)).join("\n");

        console.log(`📰 [SYNTHESIS] Low-cred articles: Cambodia=${cambodiaLowCred.length}, Thailand=${thailandLowCred.length}, Intl=${internationalLowCred.length}`);

        // ==================== BREAKING NEWS (30 most recent across all) ====================
        // Combine all, sort by publishedAt DESC (newest first), take 30
        const allArticles = [
            ...cambodiaAll.map(a => ({ ...a, country: "cambodia" })),
            ...thailandAll.map(a => ({ ...a, country: "thailand" })),
            ...internationalAll.map(a => ({ ...a, country: "international" })),
        ];
        const breakingNews = [...allArticles]
            .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
            .slice(0, 30);

        const breakingNewsList = breakingNews.map((a: any, idx: number) =>
            `${idx + 1}. [${a.country.toUpperCase()}] [${a.category}] "${a.title}" (${a.source}, cred:${a.credibility || 50})
   URL: ${a.sourceUrl || "(none)"}
   Summary: ${a.summary || "No summary"}`
        ).join("\n");

        console.log(`⚡ [SYNTHESIS] Breaking news: ${breakingNews.length} articles`);

        // Get previous analysis for context (MEMORY)
        const prevCambodia = await ctx.runQuery(api.api.getAnalysis, { target: "cambodia" }) as any;
        const prevThailand = await ctx.runQuery(api.api.getAnalysis, { target: "thailand" }) as any;
        const prevNeutral = await ctx.runQuery(api.api.getAnalysis, { target: "neutral" }) as any;

        const memoryContext = `
📜 TIMELINE (VERIFIED HISTORICAL RECORD - ${timeline.length} events):
This is the structured memory of key conflict events. Use this as your PRIMARY source of truth.
${timelineContext}

📜 PREVIOUS ANALYSIS (CONTINUITY CONTEXT):
The following was the previous analysis. Use it for context, but DO NOT be shackled by it.
- If the situation is unchanged, maintain the narrative (don't force a "new story" just for the sake of it).
- If new info contradicts the past or signals a shift, UPDATE BOLDLY.
- Your goal: ACCURACY first. Continuity second.

[PREVIOUS CAMBODIA NARRATIVE]: ${prevCambodia?.officialNarrative || "None"}
[PREVIOUS THAILAND NARRATIVE]: ${prevThailand?.officialNarrative || "None"}
[PREVIOUS NEUTRAL SUMMARY]: ${prevNeutral?.generalSummary || "None"}
[PREVIOUS POSTURE]: Cambodia=${prevCambodia?.militaryPosture}, Thailand=${prevThailand?.militaryPosture}
`;

        const prompt: string = `You are a senior geopolitical analyst providing NEUTRAL but SHARP analysis. You have TWO roles:

🎯 FOR CAMBODIA/THAILAND SECTIONS: Provide RESPECTFUL summaries of each country's perspective - what their media reports, how they frame things. You are a REPORTER here, not a judge.

⚖️ FOR THE NEUTRAL SECTION: BE A REFEREE. You're the guy calling out BS, flagging obvious spin, and pointing out when the numbers don't add up. You're fair but you're NOT a pushover. If someone's lying or exaggerating, you say it. Think sports commentator calling a bad call: assertive, clear, no diplomatic fluff.

📰 CONTEXT - HOW THESE ARTICLES WERE COLLECTED:
- CAMBODIAN SOURCES: Domestic news that Cambodian civilians read (Fresh News, DAP, VOD, Phnom Penh Post, etc.)
- THAI SOURCES: Domestic news that Thai civilians read (Thai Rath, Matichon, Bangkok Post, etc.)
- INTERNATIONAL SOURCES: Outside observers (Reuters, AP, BBC, etc.) — NOTE: "International" doesn't mean "neutral". These outlets may have access biases (e.g., easier access to one government's officials) or editorial leanings. Treat them as additional perspectives, not automatic truth.

${memoryContext}

🧠 YOUR ANALYSIS APPROACH:
- You can SEARCH THE WEB to verify claims or find additional context
- Compare how different sources frame the same events
- Identify the KEY THEMES and CONCERNS emphasized by each country's media
- Note where different sources emphasize different aspects
- Apply balanced judgment to differing accounts
- You may reference previous analysis for CONTEXT, but evaluate current news on its own merits. If evidence changes, your analysis should change.

═══════════════════════════════════════════════════════════════
🛡️ BULLETPROOF NEUTRALITY RULES (CRITICAL - READ CAREFULLY)
═══════════════════════════════════════════════════════════════

These rules ensure NO reader from ANY country can accuse you of bias:

📐 RULE 1: SYMMETRIC LANGUAGE
If you use a negative word for one country, you MUST use equally weighted language for the other.
❌ BAD: "Country A's claim is propaganda" vs "Country B's claim is unverified"
   → "Propaganda" = accusation of lying. "Unverified" = neutral uncertainty.
✅ GOOD: "Country A's claim is unverified" AND "Country B's claim is unverified"
✅ ALSO GOOD: "Country A's claim appears exaggerated" AND "Country B's claim appears exaggerated"

📐 RULE 2: ATTRIBUTION MANDATE
NEVER say "verified" or "confirmed" without naming WHO verified it.
❌ BAD: "The verified death toll is 30"
✅ GOOD: "Per Reuters/AP estimates, the death toll is approximately 30"
✅ GOOD: "International monitors (ICRC, UN) report 30-50 casualties"
If you cannot name a verifier, say "reported" not "verified".

📐 RULE 3: CONFIDENCE PARITY
Cambodia and Thailand confidence scores should be within 10 points of each other UNLESS you can justify the gap in one sentence in confidenceRationale.
❌ BAD: Cambodia 70%, Thailand 90% with no explanation
✅ GOOD: Cambodia 75%, Thailand 85% + "Higher Thai confidence due to more international wire coverage of their offensive operations"

📐 RULE 4: PROPORTIONAL CRITICISM (NEUTRAL SECTION)
Criticism should be proportional to actual discrepancies found, NOT forced 50/50 balance.
❌ BAD: Forcing equal criticism when evidence clearly shows one side fabricating more
❌ ALSO BAD: 5 paragraphs criticizing one side, silence on the other
✅ GOOD: If one side has objectively more spin, criticize proportionally BUT explicitly state: "Analysis shows more discrepancies in [Country]'s claims this period."
✅ KEY: No side gets a pass. Even if one side is worse, the other side's issues still get mentioned.

📐 RULE 5: NO EDITORIALIZING ON THIRD PARTIES
Describe what foreign leaders/organizations DID, not whether it was smart.
❌ BAD: "The US announcement was detached from reality"
✅ GOOD: "The US announced X; Country A rejected it, Country B welcomed it"

📐 RULE 6: RANGE OVER PICKING SIDES
When sources give conflicting numbers, report the RANGE, not your favorite.
❌ BAD: "Death toll is 30" (picking the international number)
✅ GOOD: "Death toll disputed: 30-50 per international monitors, 480+ per Country A claims"

📏 FICTIONAL EXAMPLES (to show the PATTERN - these are NOT about Cambodia/Thailand):
Example of SYMMETRIC criticism:
"Country A claims to have killed 500 enemy soldiers; international tallies suggest 40-60. Similarly, Country B claims zero civilian casualties from its shelling, contradicted by NGO reports of 12 civilian deaths. BOTH governments appear to be manipulating figures for domestic audiences."

Example of ATTRIBUTED claims:
"According to Red Cross field reports, approximately 2,000 civilians have fled the border region. Country A's government puts this figure at 10,000; Country B disputes any displacement occurred. The Red Cross figure is considered most reliable due to on-ground presence."

Example of BALANCED referee call:
"The situation reveals classic information warfare from BOTH sides: Country A's state media emphasizes enemy atrocities while minimizing own-side incidents; Country B's coverage does the mirror opposite. Neither domestic narrative can be taken at face value."
═══════════════════════════════════════════════════════════════

⚠️ ADDITIONAL CRITICAL ANALYSIS PRINCIPLES:
- ALL parties in a conflict have incentives to exaggerate successes and minimize losses
- Apply EQUAL skepticism to: (1) Thai government/military, (2) Cambodian government/military, (3) Both domestic media, (4) International media (which may have its own editorial biases)
- NO source type is automatically 'truth' - prioritize claims corroborated by MULTIPLE independent sources regardless of origin
- If sources disagree, NOTE THE DISCREPANCY without assuming either is correct
- BE DIRECT about discrepancies between ANY sources (Thai vs Cambodian, domestic vs international, etc.)
- CALL OUT all sides proportionally when they exaggerate, omit facts, or use nationalist framing — don't force false equivalence, but don't give anyone a free pass either
- DON'T pick sides - acknowledge uncertainty when evidence is conflicting
- CUMULATIVE BIAS CHECK: After drafting, ask yourself: "Did I give one country benefit-of-doubt more often across ALL claims?" If yes, rebalance or explicitly justify why.

📊 ARTICLE COUNT NOTE:
- The number of articles from each country may vary - this is normal and does NOT indicate importance
- Fewer articles from one country does NOT mean less activity or less validity
- Judge each perspective by QUALITY and CONTENT, not by article count
- Give equal analytical weight to all perspectives regardless of how many articles were found

⭐ CREDIBILITY SCORES (cred:XX) - USE THESE!
Each article has a credibility score. Weight your analysis accordingly:
- cred:80-100: HIGHLY RELIABLE - base your analysis primarily on these
- cred:60-79: RELIABLE - solid sources, can trust most claims
- cred:40-59: MIXED - verify claims against higher-cred sources before accepting
- cred:20-39: SKEPTICAL - likely propaganda or unverified, mention with caveats
- cred:0-19: UNRELIABLE - do not use as basis for facts, only note the narrative exists
If high-cred and low-cred articles conflict, TRUST THE HIGH-CRED SOURCE.

🌐 TRANSLATION QUALITY:
- Thai translations: ภาษาพูด (spoken Thai) - natural, conversational, like how a regular Thai person would explain to a friend. NOT formal news anchor language.
- Khmer translations: ភាសាប្រចាំថ្ងៃ (everyday Khmer) - natural, conversational, like how a Cambodian would explain to family. NOT formal government language.
- ALWAYS use English numerals (0-9) in translations - NEVER Thai ๑๒๓ or Khmer ១២៣
- Prioritize being understood by average citizens over being technically "correct"
- If unsure, leave blank rather than guess wrong

═══════════════════════════════════════════════════════════════
🔶 LOW-CREDIBILITY / UNVERIFIED ARTICLES (analyze for spin & framing):
These articles scored lowest on credibility. They may contain TRUE information presented with spin, or outright fabrications. Your job: extract what's real, flag what's exaggerated, note the framing each side uses.

🇰🇭 CAMBODIAN LOW-CRED (${cambodiaLowCred.length} articles):
${cambodiaPropaganda || "(no articles)"}

🇹🇭 THAI LOW-CRED (${thailandLowCred.length} articles):
${thailandPropaganda || "(no articles)"}

🌍 INTERNATIONAL LOW-CRED (${internationalLowCred.length} articles):
${internationalPropaganda || "(no articles)"}

⚡ BREAKING NEWS (${breakingNews.length} most recent articles across all sources):
${breakingNewsList || "(no articles)"}
═══════════════════════════════════════════════════════════════

🎖️ MILITARY POSTURE - SCORING GUIDE:
This gauge measures whether a country is DEFENDING ITSELF or INVADING OTHERS.
The bar position MUST match the posture category.

⚔️ POSTURE & INTENSITY (these MUST match!):
🟢 PEACEFUL (intensity: 0-30): No military threat, normal operations, diplomacy active
   - 0-10: Complete peace, minimal border presence
   - 11-20: Normal patrols, routine operations
   - 21-30: Heightened awareness, but no military action

🟡 DEFENSIVE (intensity: 31-55): Protecting own territory, responding to threats
   - 31-40: Reinforcing borders, moving to defensive positions
   - 41-50: Active defense, fortifying against incursion
   - 51-55: Heavy defensive action (returning fire, repelling attack) BUT staying in own territory

🔴 AGGRESSIVE (intensity: 70-100): Attacking, invading, or initiating conflict
   - 70-80: Cross-border strikes, entering disputed territory
   - 81-90: Active invasion, seizing territory
   - 91-100: Full-scale offensive war

⚠️ CRITICAL RULES:
   - If posture is PEACEFUL → intensity must be 0-30
   - If posture is DEFENSIVE → intensity must be 31-55
   - If posture is AGGRESSIVE → intensity must be 70-100
   - ASYMMETRY RULE: If one country is AGGRESSIVE and the other is DEFENSIVE, the gap MUST be at least 20 points
   - BOTH-AGGRESSIVE IS ALLOWED: If BOTH countries are conducting cross-border operations, BOTH can be AGGRESSIVE. Assign intensity based on scale/severity of each side's actions.

🏷️ POSTURE LABEL - MUST BE SHORT (MAX 6 WORDS):
Examples by posture:
  PEACEFUL: "Routine Patrols", "Normal Operations", "Diplomatic Talks"
  DEFENSIVE: "Border Reinforcement", "Defensive Positions", "Repelling Attack"
  AGGRESSIVE: "Cross-Border Strike", "Territory Seizure", "Invasion Underway"

💡 TERRITORIAL ASSESSMENT:
- Troops in UNDISPUTED own territory → DEFENSIVE
- Troops in ENEMY'S undisputed territory → AGGRESSIVE
- Troops in DISPUTED territory (e.g., areas both countries claim) → Use context. Note: "Defensive per [Country]'s claim" if ambiguous. The key is WHO MOVED FIRST into the disputed area this cycle.
- Firing AT troops entering YOUR undisputed territory → DEFENSIVE

🛡️ VERIFICATION & ACCURACY RULES:
1. NO SPECIFICITY WITHOUT SOURCE: Do NOT invent specific names (e.g., specific hill numbers, bridge names, or unit IDs) unless EXPLICITLY present in the source text. Use general terms like "high ground" or "infrastructure" if unsure.
2. PRECISE LANGUAGE: Distinguish between "rejecting a PROPOSAL" vs "rejecting a CLAIM". If a source says "We deny X happened", report it as a DENIAL, not a refusal of peace.
3. PLATFORM VERIFICATION: Do not specify weapon platforms (e.g., "Naval shelling", "F-16s") unless high-credibility sources confirm them. Use "airstrikes" or "shelling" if the specific platform is unconfirmed.
4. POLICY VS REALITY: Distinguish between official policy (e.g., "border closed by decree") and tactical reality (e.g., "crossing impassable due to fighting").

📰 KEY EVENTS STYLE GUIDE (3-5 events MAX, KEEP EACH SHORT!):
Write KEY EVENTS as SHORT headline-style bullets. MAX 20 WORDS each!
❌ TOO LONG: "Country A announces 'Ceasefire', but fighting intensifies hours later as Country B rejects the truce"
❌ TOO LONG: "Humanitarian Crisis: 330,000+ civilians displaced as borders close"
✅ GOOD: "Ceasefire collapses hours after announcement"
✅ GOOD: "Airstrikes hit key bridge; other side responds with rockets"
✅ GOOD: "330,000+ civilians displaced; borders closed"
✅ GOOD: "Both sides invoke self-defense claims at UN"

Be CONCISE. Each event = 1 short line. No multi-clause sentences. Frame events NEUTRALLY - don't imply who "started it" unless clearly established.

ANALYZE ALL PERSPECTIVES. Wrap your JSON response in <json> tags:
<json>
{
  "cambodia": {
    "officialNarrative": "2-3 sentences. What Cambodian media reports.",
    "officialNarrativeEn": "English version",
    "officialNarrativeTh": "Thai translation (formal ภาษาราชการ)",
    "officialNarrativeKh": "Khmer translation (formal ភាសាផ្លូវការ)",
    "narrativeSource": "Primary source(s)",
    "militaryIntensity": 50,
    "militaryPosture": "PEACEFUL|DEFENSIVE|AGGRESSIVE",
    "postureLabel": "Short phrase (max 4 words) of action + location",
    "postureLabelTh": "Thai translation of postureLabel",
    "postureLabelKh": "Khmer translation of postureLabel",
    "postureRationale": "1-2 detailed sentences explaining specific TACTICAL reasons (e.g. mention specific weapons, units, or locations like 'BM-21 rockets' or 'Preah Vihear' if reported) (English)",
    "postureRationaleTh": "คำอธิบายทางยุทธวิธี (Thai translation)",
    "postureRationaleKh": "ការពន្យល់អំពីយុទ្ធសាស្ត្រ (Khmer translation)",
    "biasNotes": "Key themes emphasized by Cambodian coverage",
    "confidence": 75,
    "confidenceRationale": "Based on X corroborating sources, Y contradict"
  },
  "thailand": {
    "officialNarrative": "2-3 sentences. What Thai media reports.",
    "officialNarrativeEn": "English version",
    "officialNarrativeTh": "Thai translation (formal ภาษาราชการ)",
    "officialNarrativeKh": "Khmer translation (formal ភាសាផ្លូវការ)",
    "narrativeSource": "Primary source(s)",
    "militaryIntensity": 50,
    "militaryPosture": "PEACEFUL|DEFENSIVE|AGGRESSIVE",
    "postureLabel": "Short phrase (max 4 words) of action + location",
    "postureLabelTh": "Thai translation of postureLabel",
    "postureLabelKh": "Khmer translation of postureLabel",
    "postureRationale": "1-2 detailed sentences explaining specific TACTICAL reasons (e.g. mention specific weapons, units, or locations) (English)",
    "postureRationaleTh": "คำอธิบายทางยุทธวิธี (Thai translation)",
    "postureRationaleKh": "ការពន្យល់អំពីយុទ្ធសាស្ត្រ (Khmer translation)",
    "biasNotes": "Key themes emphasized by Thai coverage",
    "confidence": 75,
    "confidenceRationale": "Based on X corroborating sources, Y contradict"
  },
  "neutral": {
    "generalSummary": "3-4 sentences. BE A REFEREE. Use SYMMETRIC language - if you criticize one side, criticize the other equally. ATTRIBUTE all claims (per Reuters, per ICRC, etc). Call out BOTH sides' BS.",
    "generalSummaryEn": "English version - MUST use symmetric language for both countries",
    "generalSummaryTh": "Thai translation - keep sharp but BALANCED tone",
    "generalSummaryKh": "Khmer translation - sharp but BALANCED, no favoritism",
    "conflictLevel": "Low|Elevated|Critical|Uncertain",
    "keyEvents": [
      "3-5 SHORT headlines, MAX 15 words each!",
      "Use NEUTRAL framing - no loaded words",
      "Include events from BOTH sides fairly"
    ],
    "keyEventsEn": ["Short headlines in English - max 15 words each"],
    "keyEventsTh": ["หัวข้อสั้นๆ ไม่เกิน 15 คำ"],
    "keyEventsKh": ["ចំណងជើងខ្លី មិនលើស 15 ពាក្យ"],
    "discrepancies": "List SPECIFIC contradictions. Use SYMMETRIC language: 'Country A claims X, Country B claims Y, international sources suggest Z'. ATTRIBUTE the 'believable' version to a NAMED source (Reuters, ICRC, etc), don't just pick one.",
    "confidence": 75,
    "confidenceRationale": "Must justify if Cambodia/Thailand confidence differs by >10 points. What's verified? What's propaganda from EACH side?"
  }
}
</json>

RULES:
- You MUST include <json> and </json> tags
- Inside the tags, output valid JSON only
- You can analyze/think before the tags
- Use English numerals (0-9) only

🔍 MANDATORY SELF-CHECK (DO THIS BEFORE OUTPUTTING):
1. SYMMETRIC LANGUAGE: Count negative words for each country in neutral section - roughly proportional to actual discrepancies found?
2. ATTRIBUTION: Every "verified/confirmed" claim has a NAMED source (Reuters, ICRC, etc)?
3. CONFIDENCE PARITY: Cambodia/Thailand confidence within 10 points, OR gap justified in rationale?
4. INTENSITY COHERENCE: If one is AGGRESSIVE and other is DEFENSIVE, is the intensity gap ≥20 points? If both AGGRESSIVE, are intensities proportional to actions?
5. NO EDITORIAL: No adjectives for third parties (Trump, UN) - only describe what they DID?
6. CUMULATIVE BIAS: Across ALL claims, did you give one country benefit-of-doubt more often? If so, explicitly note it or rebalance.
7. FOG OF WAR: If information is genuinely unclear/conflicting, say so. "Insufficient verified information" is a valid answer.`;

        try {
            // Use generic self-healing helper
            const result = await callGhostWithSelfHealing<{
                cambodia: any;
                thailand: any;
                neutral: any;
            }>(prompt, "thinking", 3, "SYNTHESIS", ["thinking", "thinking", "fast"]);

            if (!result) {
                console.log("❌ [SYNTHESIS] Invalid or missing JSON response");
                return null;
            }

            // Save Cambodia analysis
            if (result.cambodia) {
                const validPostures = ["PEACEFUL", "DEFENSIVE", "AGGRESSIVE"];
                const posture = validPostures.includes(result.cambodia.militaryPosture)
                    ? result.cambodia.militaryPosture : "DEFENSIVE";

                const validTerritories = ["OWN_TERRITORY", "DISPUTED_ZONE", "FOREIGN_TERRITORY", "BORDER_ZONE"];
                const territory = validTerritories.includes(result.cambodia.territorialContext)
                    ? result.cambodia.territorialContext : undefined;

                await ctx.runMutation(internal.api.upsertAnalysis, {
                    target: "cambodia",
                    officialNarrative: result.cambodia.officialNarrative || "No narrative available.",
                    officialNarrativeEn: result.cambodia.officialNarrativeEn,
                    officialNarrativeTh: result.cambodia.officialNarrativeTh,
                    officialNarrativeKh: result.cambodia.officialNarrativeKh,
                    narrativeSource: result.cambodia.narrativeSource || "Unknown",
                    // Enforce intensity matches posture range (DEFENSIVE: 31-55, AGGRESSIVE: 70-100)
                    militaryIntensity: posture === "PEACEFUL"
                        ? Math.max(0, Math.min(30, result.cambodia.militaryIntensity || 15))
                        : posture === "DEFENSIVE"
                            ? Math.max(31, Math.min(55, result.cambodia.militaryIntensity || 45))
                            : Math.max(70, Math.min(100, result.cambodia.militaryIntensity || 80)),
                    militaryPosture: posture,
                    postureLabel: result.cambodia.postureLabel || result.cambodia.postureLabelEn,
                    postureLabelEn: result.cambodia.postureLabelEn || result.cambodia.postureLabel,
                    postureLabelTh: result.cambodia.postureLabelTh,
                    postureLabelKh: result.cambodia.postureLabelKh,
                    postureRationale: result.cambodia.postureRationale || result.cambodia.postureRationaleEn,
                    postureRationaleEn: result.cambodia.postureRationaleEn || result.cambodia.postureRationale,
                    postureRationaleTh: result.cambodia.postureRationaleTh,
                    postureRationaleKh: result.cambodia.postureRationaleKh,
                    territorialContext: territory,
                });
                console.log(`✅[CAMBODIA] Posture: ${posture} (${result.cambodia.postureLabel || 'N/A'}), Intensity: ${result.cambodia.militaryIntensity}, Territory: ${territory || 'N/A'}`);
            }

            // Save Thailand analysis
            if (result.thailand) {
                const validPostures = ["PEACEFUL", "DEFENSIVE", "AGGRESSIVE"];
                const posture = validPostures.includes(result.thailand.militaryPosture)
                    ? result.thailand.militaryPosture : "DEFENSIVE";

                const validTerritories = ["OWN_TERRITORY", "DISPUTED_ZONE", "FOREIGN_TERRITORY", "BORDER_ZONE"];
                const territory = validTerritories.includes(result.thailand.territorialContext)
                    ? result.thailand.territorialContext : undefined;

                await ctx.runMutation(internal.api.upsertAnalysis, {
                    target: "thailand",
                    officialNarrative: result.thailand.officialNarrative || "No narrative available.",
                    officialNarrativeEn: result.thailand.officialNarrativeEn,
                    officialNarrativeTh: result.thailand.officialNarrativeTh,
                    officialNarrativeKh: result.thailand.officialNarrativeKh,
                    narrativeSource: result.thailand.narrativeSource || "Unknown",
                    // Enforce intensity matches posture range (DEFENSIVE: 31-55, AGGRESSIVE: 70-100)
                    militaryIntensity: posture === "PEACEFUL"
                        ? Math.max(0, Math.min(30, result.thailand.militaryIntensity || 15))
                        : posture === "DEFENSIVE"
                            ? Math.max(31, Math.min(55, result.thailand.militaryIntensity || 45))
                            : Math.max(70, Math.min(100, result.thailand.militaryIntensity || 80)),
                    militaryPosture: posture,
                    postureLabel: result.thailand.postureLabel || result.thailand.postureLabelEn,
                    postureLabelEn: result.thailand.postureLabelEn || result.thailand.postureLabel,
                    postureLabelTh: result.thailand.postureLabelTh,
                    postureLabelKh: result.thailand.postureLabelKh,
                    postureRationale: result.thailand.postureRationale || result.thailand.postureRationaleEn,
                    postureRationaleEn: result.thailand.postureRationaleEn || result.thailand.postureRationale,
                    postureRationaleTh: result.thailand.postureRationaleTh,
                    postureRationaleKh: result.thailand.postureRationaleKh,
                    territorialContext: territory,
                });
                console.log(`✅[THAILAND] Posture: ${posture} (${result.thailand.postureLabel || 'N/A'}), Intensity: ${result.thailand.militaryIntensity}, Territory: ${territory || 'N/A'}`);
            }

            // Save Neutral analysis (narrative + key events only, stats are handled by updateDashboard)
            if (result.neutral) {
                await ctx.runMutation(internal.api.upsertAnalysis, {
                    target: "neutral",
                    generalSummary: result.neutral.generalSummary || "No data.",
                    generalSummaryEn: result.neutral.generalSummaryEn,
                    generalSummaryTh: result.neutral.generalSummaryTh,
                    generalSummaryKh: result.neutral.generalSummaryKh,
                    conflictLevel: result.neutral.conflictLevel || "Low",
                    keyEvents: result.neutral.keyEvents || [],
                    keyEventsEn: result.neutral.keyEventsEn,
                    keyEventsTh: result.neutral.keyEventsTh,
                    keyEventsKh: result.neutral.keyEventsKh,
                });
                console.log(`✅[NEUTRAL] Conflict Level: ${result.neutral.conflictLevel} `);
            }

            return result;
        } catch (error) {
            console.error("❌ [SYNTHESIS] Error:", error);
            return null;
        }
    },
});

// =============================================================================
// STEP 3: DATABASE MANAGER
// A dedicated AI agent that verifies, updates, and maintains article quality
// COMPLETELY SEPARATE from curators - curators find, manager verifies
// =============================================================================

export const manageDatabase = internalAction({
    args: {},
    handler: async (ctx): Promise<{ reviewed: number; updated: number; archived: number }> => {
        console.log("📋 [MANAGER] Running comprehensive database review...");

        // Get ALL articles from all 3 news tables
        const cambodiaArticles: any[] = await ctx.runQuery(internal.api.getNewsInternal, { country: "cambodia", limit: 100 });
        const thailandArticles: any[] = await ctx.runQuery(internal.api.getNewsInternal, { country: "thailand", limit: 100 });
        const internationalArticles: any[] = await ctx.runQuery(internal.api.getNewsInternal, { country: "international", limit: 100 });

        const allArticles = [
            ...cambodiaArticles.map(a => ({ ...a, country: "cambodia" as const })),
            ...thailandArticles.map(a => ({ ...a, country: "thailand" as const })),
            ...internationalArticles.map(a => ({ ...a, country: "international" as const }))
        ];

        if (allArticles.length === 0) {
            console.log("⚠️ [MANAGER] No articles to manage");
            return { reviewed: 0, updated: 0, archived: 0 };
        }

        // Build detailed list for AI review
        const articlesList: string = allArticles.map((a: any, i: number) => {
            const ageInDays = Math.floor((Date.now() - (a.publishedAt || a.fetchedAt)) / (1000 * 60 * 60 * 24));
            return `${i + 1}.[${a.country.toUpperCase()}] "${a.title}"
Source: ${a.source} | Category: ${a.category}
Published: ${ageInDays} days ago | Current Credibility: ${a.credibility || 50}/100
URL: ${a.sourceUrl || "none"}
Summary: ${a.summary || "none"} `;
        }).join("\n\n");

        const prompt: string = `You are a DATABASE MANAGER and FACT-CHECKER for a news intelligence system.
You have access to WEB SEARCH - USE IT to verify claims!

🔍 YOUR VERIFICATION TASKS:
1. SEARCH THE WEB to verify each article is real (check if URL exists, source is credible)
2. CROSS-REFERENCE: If multiple articles report the same event, do they agree? Note discrepancies.
3. CHECK FOR DUPLICATES: Same story from multiple sources (flag duplicates)
4. VERIFY SOURCES: Is the domain a real news outlet? Is the URL format valid?
5. FACT-CHECK: Do claims match other reporting? Flag contradictions.

📋 CURRENT DATABASE (${allArticles.length} articles):
${articlesList}

🔬 VERIFICATION CHECKLIST FOR EACH ARTICLE:
- URL looks valid (proper domain, not gibberish)
- Source is a known news outlet (not random blog)
- Headline isn't sensationalized clickbait
- Search web to confirm event actually happened
- Check if newer articles contradict this one
- Look for duplicate stories from other sources

📊 CREDIBILITY ADJUSTMENT RULES:
• INCREASE if: Verified by web search, multiple sources confirm, reputable outlet
• DECREASE if: Can't verify, URL looks fake, source unknown, contradicted by others
• MARK FALSE if: Proven misinformation, fabricated quotes, event didn't happen
• MARK OUTDATED if: Situation has changed significantly since publication
• MARK DUPLICATE if: Same story already exists from another source

RETURN YOUR ANALYSIS wrapped in <json> tags:
<json>
{
  "actions": [
    {
      "index": 1,
      "action": "update_credibility|mark_false|mark_outdated|mark_unverified|archive|mark_duplicate|keep",
      "newCredibility": 75,
      "reason": "Brief explanation + what you found in web search",
      "duplicateOf": "(if duplicate) Title of original article"
    }
  ],
  "crossReferenceNotes": "Notes on how articles relate to each other",
  "summary": "Overall: X verified, Y suspicious, Z duplicates"
}
</json>

ACTIONS:
- update_credibility: Adjust 0-100 score (EXPLAIN why)
- mark_false: PROVEN misinformation (requires evidence)
- mark_outdated: Events no longer current
- mark_unverified: Cannot confirm, suspicious URL
- mark_duplicate: Same story from different source
- archive: Old article (>30 days) no longer relevant
- keep: Verified and fine as-is

RULES:
- You MUST include <json> and </json> tags
- Inside the tags, output valid JSON only
- You can think/analyze before the tags
- Use English numerals (0-9) only`;

        try {
            // Use generic self-healing helper
            const result = await callGhostWithSelfHealing<{
                actions: any[];
                crossReferenceNotes?: string;
                summary?: string;
            }>(prompt, "thinking", 3, "MANAGER");

            if (!result) {
                console.log("❌ [MANAGER] Invalid or missing JSON response");
                return { reviewed: allArticles.length, updated: 0, archived: 0 };
            }

            let updatedCount = 0;
            let archivedCount = 0;

            for (const action of result.actions || []) {
                const articleIndex = action.index - 1;
                if (articleIndex < 0 || articleIndex >= allArticles.length) continue;

                const article = allArticles[articleIndex];

                switch (action.action) {
                    case "update_credibility":
                        if (action.newCredibility !== undefined) {
                            await ctx.runMutation(internal.api.updateArticleCredibility, {
                                country: article.country,
                                title: article.title,
                                credibility: Math.max(0, Math.min(100, action.newCredibility)),
                            });
                            console.log(`   📊 Updated credibility: "${article.title}" → ${action.newCredibility} `);
                            updatedCount++;
                        }
                        break;

                    case "mark_false":
                        await ctx.runMutation(internal.api.flagArticle, {
                            country: article.country,
                            title: article.title,
                            status: "false",
                        });
                        console.log(`   🚫 Marked FALSE: "${article.title}"(${action.reason})`);
                        updatedCount++;
                        break;

                    case "mark_outdated":
                        await ctx.runMutation(internal.api.flagArticle, {
                            country: article.country,
                            title: article.title,
                            status: "outdated",
                        });
                        console.log(`   ⏰ Marked OUTDATED: "${article.title}"`);
                        updatedCount++;
                        break;

                    case "mark_unverified":
                        await ctx.runMutation(internal.api.flagArticle, {
                            country: article.country,
                            title: article.title,
                            status: "unverified",
                        });
                        console.log(`   ❓ Marked UNVERIFIED: "${article.title}"`);
                        updatedCount++;
                        break;

                    case "archive":
                        await ctx.runMutation(internal.api.flagArticle, {
                            country: article.country,
                            title: article.title,
                            status: "archived",
                        });
                        console.log(`   📦 ARCHIVED: "${article.title}"`);
                        archivedCount++;
                        break;

                    case "mark_duplicate":
                        // Mark as archived (duplicate of another article)
                        await ctx.runMutation(internal.api.flagArticle, {
                            country: article.country,
                            title: article.title,
                            status: "archived",
                        });
                        console.log(`   🔄 DUPLICATE: "${article.title}"(duplicate of: ${action.duplicateOf || "unknown"})`);
                        archivedCount++;
                        break;

                    case "keep":
                        // Article verified, no changes needed
                        console.log(`   ✓ Verified: "${article.title.substring(0, 50)}..."`);
                        break;
                }
            }

            console.log(`\n✅[MANAGER] Reviewed ${allArticles.length}, updated ${updatedCount}, archived ${archivedCount} `);
            if (result.crossReferenceNotes) {
                console.log(`   📝 Cross - reference notes: ${result.crossReferenceNotes} `);
            }
            if (result.summary) {
                console.log(`   📊 Summary: ${result.summary} `);
            }

            return { reviewed: allArticles.length, updated: updatedCount, archived: archivedCount };
        } catch (error) {
            console.error("❌ [MANAGER] Error:", error);
            return { reviewed: allArticles.length, updated: 0, archived: 0 };
        }
    },
});

// =============================================================================
// ORCHESTRATOR
// =============================================================================

export const runResearchCycle = internalAction({
    args: {},
    handler: async (ctx) => {
        // Check if we should skip this cycle (one-time skip, auto-resets)
        const stats = await ctx.runQuery(internal.api.getSystemStatsInternal, {});
        if (stats?.skipNextCycle) {
            console.log("⏭️ SKIPPING THIS CYCLE (skipNextCycle was set)");
            // Reset the flag so next cycle runs normally
            await ctx.runMutation(internal.api.setStatus, { status: "online" });
            await ctx.runMutation(internal.api.clearSkipNextCycle, {});
            return;
        }

        // Note: isPaused check removed - pause only affects automatic cron (which is disabled)
        // Manual runs via npx convex run always execute

        console.log("═══════════════════════════════════════════════════════════════");
        console.log("🔄 RESEARCH CYCLE STARTED");
        console.log("═══════════════════════════════════════════════════════════════");

        await ctx.runMutation(internal.api.setStatus, { status: "syncing" });

        // Time budget tracking - Convex actions timeout at 600s (10 mins)
        // Reserve 2 minutes for synthesis to ensure it always runs
        const cycleStartTime = Date.now();
        const MAX_CYCLE_TIME_MS = 8 * 60 * 1000; // 8 minutes (leaves 2 mins for synthesis)

        // Returns milliseconds remaining in our time budget (can be negative if over)
        const getTimeRemainingMs = () => MAX_CYCLE_TIME_MS - (Date.now() - cycleStartTime);

        const errors: string[] = [];

        // ===== MAIN CYCLE BODY - WRAPPED IN TRY-FINALLY TO ENSURE STATUS RESET =====
        try {
            // Step 1: Curate news (SEQUENTIAL to respect API rate limits - max 5 concurrent workers)
            console.log("\n── STEP 1: NEWS CURATION ──");

            try {
                console.log("   > Curating Cambodia...");
                await ctx.runAction(internal.research.curateCambodia, {});
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2s cooler
            } catch (e) {
                console.error("❌ [STEP 1] Cambodia Curation Failed:", e);
                errors.push(`Cambodia: ${String(e)}`);
            }

            try {
                console.log("   > Curating Thailand...");
                await ctx.runAction(internal.research.curateThailand, {});
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2s cooler
            } catch (e) {
                console.error("❌ [STEP 1] Thailand Curation Failed:", e);
                errors.push(`Thailand: ${String(e)}`);
            }

            try {
                console.log("   > Curating International...");
                await ctx.runAction(internal.research.curateInternational, {});
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2s cooler
            } catch (e) {
                console.error("❌ [STEP 1] International Curation Failed:", e);
                errors.push(`International: ${String(e)}`);
            }

            // ABSOLUTE STOP CHECK: If curation failed completely, there's no point continuing
            if (errors.length >= 3) {
                console.error("🛑 ALL CURATION STEPS FAILED. Aborting cycle.");
                await ctx.runMutation(internal.api.setStatus, { status: "error", errorLog: "Curation failed completely" });
                return;
            }

            // Step 2: Source Verification - Verify URLs and content accuracy
            console.log("\n── STEP 2: SOURCE VERIFICATION ──");
            try {
                console.log("   > Verifying article sources...");
                const verifyResult = await ctx.runAction(internal.research.verifyAllSources, {});
                console.log(`   ✅ Verified: ${verifyResult.verified}, Updated: ${verifyResult.updated}, Deleted: ${verifyResult.deleted}, Errors: ${verifyResult.errors}`);
            } catch (e) {
                console.error("❌ [STEP 2] Source Verification Failed:", e);
                errors.push(`Verification: ${String(e)}`);
                // Non-fatal - continue with historian even if verification fails
            }

            // Step 3: Historian Loop - Process ALL unprocessed articles
            console.log("\n── STEP 3: HISTORIAN LOOP ──");
            let historianLoops = 0;
            const MAX_HISTORIAN_LOOPS = 20;  // Safety cap to prevent infinite loops
            const MIN_TIME_FOR_ITERATION_MS = 90 * 1000; // Need at least 90s to start a new iteration

            try {
                while (historianLoops < MAX_HISTORIAN_LOOPS) {
                    // TIME BUDGET CHECK - Don't start new iteration if we're running low
                    const timeRemaining = getTimeRemainingMs();
                    if (timeRemaining < MIN_TIME_FOR_ITERATION_MS) {
                        console.log(`   ⏰ Time budget low (${Math.round(timeRemaining / 1000)}s remaining) - stopping historian to ensure synthesis runs`);
                        console.log(`   📋 Remaining articles will be processed in the next cycle`);
                        break;
                    }

                    historianLoops++;
                    console.log(`\n   📜 Historian iteration ${historianLoops}... (${Math.round(timeRemaining / 1000)}s remaining)`);

                    const result = await ctx.runAction(internal.historian.runHistorianCycle, {});

                    // Check if historian found any articles to process
                    if (!result || result.processed === 0) {
                        console.log("   ✅ Historian complete - no more articles to process");
                        break;
                    }

                    console.log(`   Processed ${result.processed} articles, created ${result.eventsCreated} events`);

                    // Brief cooldown between iterations
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

                if (historianLoops >= MAX_HISTORIAN_LOOPS) {
                    console.warn(`   ⚠️ Historian reached max iterations (${MAX_HISTORIAN_LOOPS})`);
                }

                console.log(`   📊 Historian completed after ${historianLoops} iterations`);
            } catch (e) {
                console.error("❌ [STEP 3] Historian Failed:", e);
                errors.push(`Historian: ${String(e)}`);
            }

            // Step 4: Combined Synthesis
            console.log("\n── STEP 4: SYNTHESIS ──");
            try {
                await ctx.runAction(internal.research.synthesizeAll, {});
            } catch (e) {
                console.error("❌ [STEP 4] Synthesis Failed:", e);
                errors.push(`Synthesis: ${String(e)}`);
            }

            // Final Status Update (inside try block)
            if (errors.length === 0) {
                console.log("═══════════════════════════════════════════════════════════════");
                console.log("✅ RESEARCH CYCLE COMPLETE (SUCCESS)");
                console.log("═══════════════════════════════════════════════════════════════");
            } else {
                console.log("═══════════════════════════════════════════════════════════════");
                console.log("⚠️ RESEARCH CYCLE COMPLETE (WITH ERRORS)");
                console.log("Errors encountered:", errors);
                console.log("═══════════════════════════════════════════════════════════════");
            }
        } catch (unexpectedError) {
            // Catch any unexpected errors that weren't caught by individual step handlers
            console.error("🛑 RESEARCH CYCLE CRASHED WITH UNEXPECTED ERROR:", unexpectedError);
            errors.push(`Unexpected: ${String(unexpectedError)}`);
        } finally {
            // ===== ALWAYS RESET STATUS - EVEN ON CRASH =====
            // This ensures the frontend timer doesn't get stuck on "RUNNING..."
            console.log("🔄 Resetting status to online (finally block)");
            try {
                if (errors.length > 0) {
                    await ctx.runMutation(internal.api.setStatus, { status: "online", errorLog: errors.join(" | ") });
                } else {
                    await ctx.runMutation(internal.api.setStatus, { status: "online" });
                }
            } catch (statusError) {
                console.error("❌ Failed to reset status:", statusError);
            }
        }
    },
});

// =============================================================================
// DASHBOARD CONTROLLER (Single API Call for Stats)
// =============================================================================

export const updateDashboard = internalAction({
    args: {},
    handler: async (ctx) => {
        console.log("📊 [DASHBOARD] Starting live stats update...");

        // Get previous stats
        const prevStats = await ctx.runQuery(api.api.getDashboardStats, {}) as any;

        // ==================== TIMELINE CONTEXT (same as synthesizeAll) ====================
        const timeline = await ctx.runQuery(internal.api.getRecentTimeline, { limit: 30 });
        const timelineContext = timeline.length > 0
            ? timeline.map((e: any) => {
                const timeDisplay = e.timeOfDay ? `, ${e.timeOfDay}` : "";
                const topSources = [...e.sources]
                    .sort((a: any, b: any) => (b.credibility || 50) - (a.credibility || 50))
                    .slice(0, 3);
                const sourceDetails = topSources
                    .map((s: any) => `${s.name} (cred:${s.credibility || 50}): ${s.url}`)
                    .join("\n     ");
                return `[${e.date}${timeDisplay}] ${e.title} (${e.category}, importance:${e.importance})
   ${e.description}
   Sources: ${sourceDetails || "(none)"}`;
            }).join("\n\n")
            : "(No timeline events)";

        // ==================== ARTICLE CONTEXT (same as synthesizeAll) ====================
        const cambodiaAll: any[] = await ctx.runQuery(internal.api.getNewsInternal, { country: "cambodia", limit: 50 });
        const thailandAll: any[] = await ctx.runQuery(internal.api.getNewsInternal, { country: "thailand", limit: 50 });
        const internationalAll: any[] = await ctx.runQuery(internal.api.getNewsInternal, { country: "international", limit: 50 });

        // Helper to format article
        const formatArticle = (a: any) =>
            `- [${a.category}] "${a.title}" (${a.source}, cred:${a.credibility || 50})
   URL: ${a.sourceUrl || "(none)"}
   Summary: ${a.summary || "No summary"}`;

        // Low credibility articles (10 per country for dashboard - smaller than synthesis)
        const cambodiaLowCred = [...cambodiaAll]
            .sort((a, b) => (a.credibility || 50) - (b.credibility || 50))
            .slice(0, 10);
        const thailandLowCred = [...thailandAll]
            .sort((a, b) => (a.credibility || 50) - (b.credibility || 50))
            .slice(0, 10);
        const internationalLowCred = [...internationalAll]
            .sort((a, b) => (a.credibility || 50) - (b.credibility || 50))
            .slice(0, 10);

        const cambodiaPropaganda = cambodiaLowCred.map(formatArticle).join("\n");
        const thailandPropaganda = thailandLowCred.map(formatArticle).join("\n");
        const internationalPropaganda = internationalLowCred.map(formatArticle).join("\n");

        // Breaking news (20 most recent)
        const allArticles = [
            ...cambodiaAll.map(a => ({ ...a, country: "cambodia" })),
            ...thailandAll.map(a => ({ ...a, country: "thailand" })),
            ...internationalAll.map(a => ({ ...a, country: "international" })),
        ];
        const breakingNews = [...allArticles]
            .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
            .slice(0, 20);

        const breakingNewsList = breakingNews.map((a: any) =>
            `- [${a.country.toUpperCase()}] [${a.category}] "${a.title}" (${a.source}, cred:${a.credibility || 50})
   Summary: ${a.summary || "No summary"}`
        ).join("\n");

        console.log(`📊 [DASHBOARD] Context: ${timeline.length} timeline events, ${breakingNews.length} breaking news`);

        const prompt = `You are the DASHBOARD CONTROLLER for the BorderClash monitor.
Your job is to maintain ACCURATE, STABLE statistics - NOT to invent changes.

⚠️ CRITICAL RULE - STABILITY OVER ACTIVITY:
- Numbers should ONLY change when there is NEW, VERIFIED evidence
- If nothing has changed, RETURN THE SAME NUMBERS
- It is 100% acceptable to return identical values to previous update
- DO NOT make small random adjustments just to show "activity"
- Accuracy and stability matter MORE than frequent updates

📊 CURRENT DASHBOARD STATS (from previous update):

Conflict Level: ${prevStats?.conflictLevel || "UNKNOWN"}
Casualties: ${prevStats?.casualtyCount || 0}
Displaced: ${prevStats?.displacedCount || 0} (Trend: ${prevStats?.displacedTrend || 0}%)
Civilian Injured: ${prevStats?.civilianInjuredCount || 0}
Military Injured: ${prevStats?.militaryInjuredCount || 0}


═══════════════════════════════════════════════════════════════
📜 TIMELINE (VERIFIED EVENTS - PRIMARY SOURCE):
These are confirmed, verified events with sources. Base your assessment primarily on these:

${timelineContext}
═══════════════════════════════════════════════════════════════

🔴 LOW-CREDIBILITY / PROPAGANDA ARTICLES (for context - be skeptical):

🇰🇭 CAMBODIAN LOW-CRED (${cambodiaLowCred.length} articles):
${cambodiaPropaganda || "(none)"}

🇹🇭 THAI LOW-CRED (${thailandLowCred.length} articles):
${thailandPropaganda || "(none)"}

🌍 INTERNATIONAL LOW-CRED (${internationalLowCred.length} articles):
${internationalPropaganda || "(none)"}

⚡ BREAKING NEWS (${breakingNews.length} most recent):
${breakingNewsList || "(none)"}
═══════════════════════════════════════════════════════════════

🔍 YOUR TASK:
1. Review the timeline events above for any NEW information about casualties/displaced
2. Cross-reference with breaking news - does it confirm or contradict?
3. Be SKEPTICAL of low-cred sources - they often exaggerate numbers
4. ONLY if there is clear, verified evidence of change, update the numbers
5. If nothing significant has changed, KEEP CURRENT NUMBERS

📊 WHEN TO CHANGE NUMBERS:
✅ CHANGE IF: Timeline shows new confirmed casualties (check sources!)
✅ CHANGE IF: Multiple HIGH-credibility sources confirm different numbers
❌ DON'T CHANGE IF: Only low-cred sources report new numbers
❌ DON'T CHANGE IF: Numbers are "estimates" or "unconfirmed"
❌ DON'T CHANGE IF: Breaking news just repeats old events

🌐 WEB SEARCH - USE IT TO VERIFY:
You have access to web search. Use it to:
- Verify casualty numbers from international wire services (Reuters, AP, AFP)
- Check for official government announcements
- Cross-reference claims from the timeline/articles above
- Search in English, Thai (ไทย กัมพูชา ปะทะ), and Khmer (ការប៉ះទង្គិច ព្រំដែន)
If your search confirms the current numbers are still accurate, KEEP THEM.

 CONFLICT LEVEL (use UPPERCASE):
- "LOW": No kinetic action, only diplomatic words
- "ELEVATED": Troop movements, drills, minor skirmishes, small-scale evacuations
- "CRITICAL": Sustained shelling, confirmed fatalities, major offensive
- "UNCERTAIN": Conflicting reports, cannot determine with confidence

🔢 STATS RULES:
- displaced: Only change if NEW displacement events in timeline
- fatalities: CUMULATIVE total - can only increase, never decrease
- civilianInjured: Separate civilian injuries
- militaryInjured: Separate military injuries

Wrap your response in <json> tags:
<json>
{
  "conflictLevel": "${prevStats?.conflictLevel || "LOW"}",
  "unchanged": true,
  "changeReason": "No new verified information - keeping stable values",
  "stats": {
    "displaced": ${prevStats?.displacedCount || 0},
    "fatalities": ${prevStats?.casualtyCount || 0},
    "civilianInjured": ${prevStats?.civilianInjuredCount || 0},
    "militaryInjured": ${prevStats?.militaryInjuredCount || 0}
  }
}
</json>

NOTE: The above JSON shows the CURRENT values. If nothing has changed, you can return this EXACTLY.
Only modify values if you have found new verified evidence.

RULES:
- You MUST include <json> and </json> tags
- Inside the tags, output valid JSON only
- "unchanged": true means you're returning same values (this is GOOD if nothing changed)
- "unchanged": false means you found new evidence and are updating
- Use English numerals (0-9) only`;

        interface DashboardData {
            conflictLevel?: string;
            unchanged?: boolean;  // true = keeping same values (this is good!)
            changeReason?: string;  // Explanation of why changed or kept same
            stats?: {
                displaced?: number;
                displacedTrend?: number;  // % change from 1 week ago
                fatalities?: number;
                civilianInjured?: number;
                militaryInjured?: number;
                injured?: number; // Legacy fallback
            };
        }

        try {
            // Use generic self-healing helper
            const data = await callGhostWithSelfHealing<DashboardData>(
                prompt,
                "thinking",
                3,
                "DASHBOARD"
            );

            if (!data) {
                return;
            }

            // Log whether values changed or stayed the same
            if (data.unchanged) {
                console.log(`✅ [DASHBOARD] No changes needed: ${data.changeReason || "values stable"}`);
            } else {
                console.log(`📊 [DASHBOARD] Updating values: ${data.changeReason || "new evidence found"}`);
            }
            console.log("📊 [DASHBOARD] Parsed data:", data);

            // Update Database (even if unchanged - this updates lastUpdatedAt)
            await ctx.runMutation(internal.api.upsertDashboardStats, {
                conflictLevel: data.conflictLevel || prevStats?.conflictLevel || "LOW",
                displacedCount: data.stats?.displaced ?? prevStats?.displacedCount ?? 0,
                displacedTrend: data.stats?.displacedTrend ?? prevStats?.displacedTrend ?? 0,
                casualtyCount: data.stats?.fatalities ?? prevStats?.casualtyCount ?? 0,
                civilianInjuredCount: data.stats?.civilianInjured ?? prevStats?.civilianInjuredCount ?? 0,
                militaryInjuredCount: data.stats?.militaryInjured ?? prevStats?.militaryInjuredCount ?? 0,
            });

            console.log("💾 [DASHBOARD] Database updated successfully.");

        } catch (error) {
            console.error("❌ [DASHBOARD] Update failed:", error);
        }
    }
});

// =============================================================================
// SOURCE VERIFICATION / ARTICLE CREDIBILITY ("articlecred" step)
// Pipeline: curator > articlecred > historian > synth
// Note: The old validation.ts loop is deprecated. This is the new approach.
// =============================================================================

/**
 * Verify all sources in the database
 * Goes through each article, fetches the URL via Ghost API, and verifies:
 * 1. URL is accessible (not 404)
 * 2. Summary matches actual content
 * 3. Title is accurate
 * 4. Article is about Thailand-Cambodia relations
 * 
 * Articles that fail verification get marked for deletion or credibility reduced
 */
export const verifyAllSources = internalAction({
    args: {},
    handler: async (ctx): Promise<{ verified: number; updated: number; deleted: number; errors: number }> => {
        console.log("🔍 [SOURCE VERIFY] Starting comprehensive source verification...");

        // Generate unique run ID
        const runId = `verify-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Try to acquire lock (prevents duplicate runs, cleans up zombies)
        const lockResult = await ctx.runMutation(internal.api.acquireSourceVerificationLock, { runId });

        if (!lockResult.acquired) {
            console.log(`❌ [SOURCE VERIFY] Could not acquire lock - another run is active`);
            return { verified: 0, updated: 0, deleted: 0, errors: 0 };
        }

        if (lockResult.tookOverZombie) {
            console.log(`🧟 [SOURCE VERIFY] Took over zombie session`);
        }

        console.log(`🔒 [SOURCE VERIFY] Lock acquired (runId: ${runId})`);

        // Wrap in try/finally to ensure lock is always released
        try {
            // Get all articles from all tables
            const cambodiaArticles: any[] = await ctx.runQuery(internal.api.getNewsInternal, { country: "cambodia", limit: 500 });
            const thailandArticles: any[] = await ctx.runQuery(internal.api.getNewsInternal, { country: "thailand", limit: 500 });
            const internationalArticles: any[] = await ctx.runQuery(internal.api.getNewsInternal, { country: "international", limit: 500 });

            const allArticlesRaw = [
                ...cambodiaArticles.map(a => ({ ...a, country: "cambodia" as const })),
                ...thailandArticles.map(a => ({ ...a, country: "thailand" as const })),
                ...internationalArticles.map(a => ({ ...a, country: "international" as const })),
            ];

            // Filter out articles without URLs (can't verify without a URL)
            const withUrls = allArticlesRaw.filter(a => a.sourceUrl && a.sourceUrl.length > 10);
            const skippedNoUrl = allArticlesRaw.length - withUrls.length;

            // Filter out already-verified articles (only check new/unverified)
            const allArticles = withUrls.filter(a => !a.sourceVerifiedAt);
            const alreadyVerified = withUrls.length - allArticles.length;

            console.log(`📊 [SOURCE VERIFY] Found ${allArticlesRaw.length} total articles`);
            console.log(`   Cambodia: ${cambodiaArticles.length}, Thailand: ${thailandArticles.length}, International: ${internationalArticles.length}`);
            if (skippedNoUrl > 0) {
                console.log(`   ⚠️ Skipping ${skippedNoUrl} articles without valid URLs`);
            }
            if (alreadyVerified > 0) {
                console.log(`   ✅ Skipping ${alreadyVerified} already-verified articles`);
            }
            console.log(`   → Will verify: ${allArticles.length} NEW articles`);

            let verified = 0;
            let flagged = 0;
            let deleted = 0;
            let errors = 0;

            // Early return if no articles to verify
            if (allArticles.length === 0) {
                console.log(`✅ [SOURCE VERIFY] No articles to verify!`);
                return { verified: 0, updated: 0, deleted: 0, errors: 0 };
            }

            // Process 1 article at a time to avoid Ghost API timeouts
            const BATCH_SIZE = 5;

            for (let i = 0; i < allArticles.length; i += BATCH_SIZE) {
                const batch = allArticles.slice(i, i + BATCH_SIZE);
                const batchNum = Math.floor(i / BATCH_SIZE) + 1;
                const totalBatches = Math.ceil(allArticles.length / BATCH_SIZE);
                console.log(`\n📦 [SOURCE VERIFY] Processing batch ${batchNum}/${totalBatches}...`);

                // Update heartbeat so we don't get marked as zombie
                await ctx.runMutation(internal.api.updateSourceVerificationProgress, {
                    runId,
                    progress: `batch ${batchNum}/${totalBatches}`,
                });

                // Build verification prompt for the batch
                const articlesToVerify = batch.map((a, idx) => {
                    const storedDate = a.publishedAt ? new Date(a.publishedAt).toISOString() : "(unknown)";
                    return `ARTICLE ${idx + 1}:
URL: ${a.sourceUrl || "(missing)"}
Stored Title: "${a.title}"
Stored Summary: "${a.summary || a.summaryEn || "(none)"}"
Stored Date: ${storedDate}
Country: ${a.country}
Credibility: ${a.credibility}`;
                }).join("\n\n");

                const verificationPrompt = `You are a SOURCE VERIFICATION AGENT. Your job is to verify that articles in our database are REAL and ACCURATE.

⚠️ CRITICAL: VISIT THE URL DIRECTLY
- DO NOT search for the article by title/name - this can lead to wrong results!
- DIRECTLY NAVIGATE to the exact URL provided
- Check if the URL loads the actual article page (not an image or attachment page)
- If the URL redirects or shows wrong content, try to find the correct article URL

🔍 YOUR TASK:
For each article below, you MUST:
1. VISIT the URL DIRECTLY (don't search by title!, as we want to make sure the URL is correct)
2. CHECK if it loads an article page (not an image, not a redirect to wrong page)
3. READ the actual content
4. COMPARE the stored summary/title against what the page ACTUALLY says
5. CHECK the publish date on the page
6. DETERMINE if the article is about Thailand-Cambodia relations

⚠️ VERIFICATION CRITERIA:
- VERIFIED: URL works AND shows article page AND summary accurately reflects the content AND it's about Thailand-Cambodia
- NEEDS_UPDATE: URL works, article IS about Thailand-Cambodia, but our title/summary/date/URL is WRONG → provide corrections!
- URL_DEAD: The URL returns 404, 403, or page not found
- URL_WRONG: The URL redirects to wrong page (image, attachment, different article) → provide correctUrl!
- OFF_TOPIC: The article is NOT about Thailand-Cambodia border/relations (different topic entirely)
- HALLUCINATED: The URL exists but shows completely different content (e.g., we said "border clash" but page is about "cooking recipes")

📋 ARTICLES TO VERIFY:
${articlesToVerify}

OUTPUT FORMAT - Wrap your JSON in <json> tags:
<json>
{
  "results": [
    {
      "articleIndex": 1,
      "status": "VERIFIED|NEEDS_UPDATE|URL_DEAD|URL_WRONG|OFF_TOPIC|HALLUCINATED",
      "actualTitle": "What the page headline actually says (original language)",
      "actualSummary": "2-3 sentence summary of what the article ACTUALLY says",
      "actualPublishedAt": "2025-12-14T10:00:00Z or null if cannot determine",
      "isAboutBorder": true,
      "matchScore": 85,
      "reason": "Why you made this determination",
      "correctUrl": "https://correct-url.com/article if URL was wrong, otherwise null",
      
      "correctData": {
        // ONLY include fields that need fixing! Omit fields that are already correct.
        // If only date is wrong, just include: "publishedAt": "2025-12-14T10:00:00Z"
        // If only title is wrong, include title + translations
        // Example - only date wrong:
        // "correctData": { "publishedAt": "2025-12-14T16:00:00Z" }
        // Example - title wrong:
        // "correctData": { "title": "...", "titleEn": "...", "titleTh": "...", "titleKh": "..." }
      }
    }
  ]
}
</json>

🌐 TRANSLATION RULES (for correctData):
- Thai: ภาษาพูด (spoken Thai) - casual everyday language like how a regular Thai person would say it to a friend
- Khmer: ភាសាប្រចាំថ្ងៃ (everyday Khmer) - casual conversational language like how a Cambodian would explain to family
- NOT formal/government language - use words regular people actually use
- ALWAYS use English numerals (0-9) - NEVER Thai ๑๒๓ or Khmer ១២៣
- If unsure about translation quality, leave that translation field as empty string ""

📝 IMPORTANT - ANALYZE ARTICLES IN ORDER BEFORE JSON:
Before outputting your JSON, you MUST first list each article with your findings.
This helps you keep track and avoid mixing up URLs/results between articles.

Example format (put this BEFORE the <json> tags):
---
VERIFICATION RESULTS:
1. URL: https://thairath.co.th/xxxxx
   → Page loads? ✅ Yes, article page
   → Headline on page: "ทบ.สรุปปะทะชายแดน..."
   → Matches stored title? ✅ Yes
   → Matches stored summary? ⚠️ Partial - summary overstates casualty claims
   → Date on page: Dec 13, 2025
   → About Thailand-Cambodia? ✅ Yes
   → STATUS: NEEDS_UPDATE (date wrong)

2. URL: https://freshnews.com/yyyyy
   → Page loads? ❌ 404 Not Found
   → STATUS: URL_DEAD

3. URL: https://reuters.com/zzzzz
   → Page loads? ✅ Yes
   → Content matches? ✅ Yes
   → STATUS: VERIFIED
---
<json>
{ ... your JSON results matching the analysis above ... }
</json>

⚠️ DOUBLE-CHECK: Before outputting JSON, verify that:
- Each result's articleIndex matches the article you analyzed
- You haven't mixed up Article 1's URL with Article 2's result
- The status matches your analysis above

RULES:
- You MUST visit each URL - do not guess
- If you cannot access a URL, mark it URL_DEAD
- matchScore: 0-100, how well the stored summary matches actual content
- For NEEDS_UPDATE: only include fields that are WRONG in correctData!
  → Don't include fields that are already correct - that's wasteful
  → If only date is wrong: correctData: { "publishedAt": "..." }
  → If title AND summary wrong: include all title/summary fields
- For dates: Look for "Published:", "Posted:", date in URL, or article metadata. If unclear, set to null
- Articles about internal Cambodian/Thai politics (not border-related) = OFF_TOPIC`;

                try {
                    const response = await callGhostAPI(verificationPrompt, "fast", 2);

                    // Extract JSON
                    let jsonStr: string | null = null;
                    const tagMatch = response.match(/<json>([\s\S]*?)<\/json>/i);
                    if (tagMatch) {
                        jsonStr = tagMatch[1].trim();
                    } else {
                        const cleanedResponse = response
                            .replace(/```json\s*/g, "").replace(/```\s*/g, "")
                            .trim();
                        const firstOpen = cleanedResponse.indexOf('{');
                        const lastClose = cleanedResponse.lastIndexOf('}');
                        if (firstOpen !== -1 && lastClose !== -1) {
                            jsonStr = cleanedResponse.substring(firstOpen, lastClose + 1);
                        }
                    }

                    if (!jsonStr) {
                        console.log(`   ⚠️ No JSON in response, skipping batch`);
                        errors += batch.length;
                        continue;
                    }

                    // Parse JSON with error handling
                    let result;
                    try {
                        result = JSON.parse(jsonStr);
                    } catch (parseError: any) {
                        console.log(`   ⚠️ Failed to parse JSON: ${parseError.message}`);
                        console.log(`   Raw JSON (first 200 chars): ${jsonStr.substring(0, 200)}`);
                        errors += batch.length;
                        continue;
                    }

                    // Track which articles in batch were processed
                    const processedIndices = new Set<number>();

                    // Process results
                    for (const r of result.results || []) {
                        const articleIndex = (r.articleIndex || 1) - 1;
                        if (articleIndex < 0 || articleIndex >= batch.length) {
                            console.log(`   ⚠️ Invalid articleIndex ${r.articleIndex}, skipping`);
                            continue;
                        }

                        processedIndices.add(articleIndex);
                        const article = batch[articleIndex];
                        const status = r.status?.toUpperCase() || "UNKNOWN";

                        switch (status) {
                            case "VERIFIED":
                                // Mark as source-verified so it won't be re-checked
                                await ctx.runMutation(internal.api.markSourceVerified, {
                                    title: article.title,
                                    country: article.country,
                                });
                                verified++;
                                console.log(`   ✅ VERIFIED: "${article.title?.substring(0, 50)}..."`);
                                console.log(`      URL: ${article.sourceUrl}`);
                                console.log(`      Match: ${r.matchScore || 100}%`);
                                break;

                            case "URL_DEAD":
                                // Delete articles with dead URLs
                                try {
                                    await ctx.runMutation(internal.api.deleteArticle, {
                                        title: article.title,
                                        country: article.country,
                                    });
                                    deleted++;
                                    console.log(`   🗑️ DELETED (404 - URL Dead)`);
                                    console.log(`      URL: ${article.sourceUrl}`);
                                    console.log(`      Old Title: "${article.title}"`);
                                    console.log(`      Reason: ${r.reason || "URL not accessible"}`);
                                } catch (e) {
                                    console.log(`   ⚠️ Failed to delete: "${article.title?.substring(0, 40)}..."`);
                                    flagged++;
                                }
                                break;

                            case "URL_WRONG":
                                // URL redirects to wrong page - try to fix if correctUrl provided
                                if (r.correctUrl) {
                                    // Skip if "new" URL is same as old (AI hallucinated a fix)
                                    if (r.correctUrl === article.sourceUrl) {
                                        console.log(`   ⚠️ AI returned same URL as "fix" - skipping`);
                                        console.log(`      URL: ${article.sourceUrl}`);
                                        flagged++;
                                    } else {
                                        try {
                                            await ctx.runMutation(internal.api.updateArticleUrl, {
                                                country: article.country,
                                                oldTitle: article.title,
                                                newUrl: r.correctUrl,
                                            });
                                            flagged++;
                                            console.log(`   🔗 URL FIXED`);
                                            console.log(`      OLD URL: ${article.sourceUrl}`);
                                            console.log(`      NEW URL: ${r.correctUrl}`);
                                            console.log(`      Reason: ${r.reason || "URL redirected to wrong page"}`);
                                        } catch (e) {
                                            console.log(`   ⚠️ Failed to update URL: "${article.title?.substring(0, 40)}..."`);
                                            errors++;
                                        }
                                    }
                                } else {
                                    // No correct URL provided, delete it
                                    try {
                                        await ctx.runMutation(internal.api.deleteArticle, {
                                            title: article.title,
                                            country: article.country,
                                        });
                                        deleted++;
                                        console.log(`   🗑️ DELETED (Wrong URL, no correction found)`);
                                        console.log(`      URL: ${article.sourceUrl}`);
                                        console.log(`      Reason: ${r.reason || "URL redirects to wrong content"}`);
                                    } catch (e) {
                                        errors++;
                                    }
                                }
                                break;

                            case "HALLUCINATED":
                                // Hallucinated = definitely delete
                                try {
                                    await ctx.runMutation(internal.api.deleteArticle, {
                                        title: article.title,
                                        country: article.country,
                                    });
                                    deleted++;
                                    console.log(`   🗑️ DELETED (HALLUCINATED - Curator made this up!)`);
                                    console.log(`      URL: ${article.sourceUrl}`);
                                    console.log(`      Curator said: "${article.title}"`);
                                    console.log(`      Curator summary: "${(article.summary || article.summaryEn || "").substring(0, 100)}..."`);
                                    console.log(`      Page actually says: "${r.actualTitle || "(couldn't read)"}"`);
                                    console.log(`      Page is about: ${r.actualSummary || r.actualTopic || "(unknown)"}`);
                                    console.log(`      Reason: ${r.reason || "Content completely different"}`);
                                } catch (e) {
                                    console.log(`   ⚠️ Failed to delete hallucinated article`);
                                    flagged++;
                                }
                                break;

                            case "NEEDS_UPDATE":
                                // URL is valid, article IS about Thailand-Cambodia, but data is wrong
                                // Only update fields that AI says need fixing (sparse update)
                                const cd = r.correctData || {}; // correctData object - only contains fields that need fixing

                                // Only use corrected values if AI provided them, otherwise keep existing
                                const hasTitle = cd.title !== undefined;
                                const hasSummary = cd.summary !== undefined || cd.summaryEn !== undefined;
                                const hasDate = cd.publishedAt !== undefined || r.actualPublishedAt !== undefined;

                                // Build update object with only changed fields
                                const updateData: any = {
                                    country: article.country,
                                    oldTitle: article.title,
                                    credibility: Math.min(100, (article.credibility || 50) + 10), // Boost cred - now verified!
                                    status: "active",
                                };

                                // Only add title fields if title needs fixing
                                if (hasTitle) {
                                    updateData.newTitle = cd.title || r.actualTitle;
                                    // Use undefined checks to allow empty strings (clearing values)
                                    if (cd.titleEn !== undefined) updateData.newTitleEn = cd.titleEn;
                                    if (cd.titleTh !== undefined) updateData.newTitleTh = cd.titleTh;
                                    if (cd.titleKh !== undefined) updateData.newTitleKh = cd.titleKh;
                                }

                                // Only add summary fields if summary needs fixing
                                if (hasSummary) {
                                    updateData.newSummary = cd.summary || cd.summaryEn || r.actualSummary || "";
                                    if (cd.summaryEn !== undefined) updateData.newSummaryEn = cd.summaryEn;
                                    if (cd.summaryTh !== undefined) updateData.newSummaryTh = cd.summaryTh;
                                    if (cd.summaryKh !== undefined) updateData.newSummaryKh = cd.summaryKh;
                                }

                                // Only add date if date needs fixing
                                if (hasDate) {
                                    const dateStr = cd.publishedAt || r.actualPublishedAt;
                                    if (dateStr && dateStr !== "null") {
                                        const parsed = new Date(dateStr).getTime();
                                        if (!isNaN(parsed)) {
                                            updateData.publishedAt = parsed;
                                        }
                                    }
                                }

                                try {
                                    await ctx.runMutation(internal.api.updateArticleContent, updateData);
                                    flagged++; // Count as "fixed"

                                    // Smart logging - only show what actually changed
                                    console.log(`   📝 UPDATED`);
                                    console.log(`      URL: ${article.sourceUrl}`);

                                    if (hasTitle) {
                                        console.log(`      Title: "${article.title?.substring(0, 50)}..." → "${(cd.title || r.actualTitle)?.substring(0, 50)}..."`);
                                    }
                                    if (hasSummary) {
                                        console.log(`      Summary: Updated`);
                                    }
                                    if (hasDate && updateData.publishedAt) {
                                        const oldDate = article.publishedAt ? new Date(article.publishedAt).toISOString() : "(unknown)";
                                        const newDate = new Date(updateData.publishedAt).toISOString();
                                        console.log(`      Date: ${oldDate} → ${newDate}`);
                                    }
                                    console.log(`      Reason: ${r.reason || "Data didn't match actual content"}`);
                                } catch (e) {
                                    console.log(`   ⚠️ Failed to update article content`);
                                    errors++;
                                }
                                break;

                            case "OFF_TOPIC":
                                // Delete off-topic articles
                                try {
                                    await ctx.runMutation(internal.api.deleteArticle, {
                                        title: article.title,
                                        country: article.country,
                                    });
                                    deleted++;
                                    console.log(`   🗑️ DELETED (OFF-TOPIC - Not about Thailand-Cambodia)`);
                                    console.log(`      URL: ${article.sourceUrl}`);
                                    console.log(`      Curator said: "${article.title}"`);
                                    console.log(`      Page is actually about: ${r.actualSummary || r.actualTopic || "(unknown)"}`);
                                    console.log(`      Reason: ${r.reason || "Not related to Thailand-Cambodia border"}`);
                                } catch (e) {
                                    console.log(`   ⚠️ Failed to delete off-topic article`);
                                    flagged++;
                                }
                                break;

                            default:
                                console.log(`   ❓ Unknown status "${status}" for: "${article.title?.substring(0, 40)}..."`);
                                errors++;
                        }
                    }

                    // Check for articles not returned by AI (missing from results)
                    const unprocessedCount = batch.length - processedIndices.size;
                    if (unprocessedCount > 0) {
                        console.log(`   ⚠️ ${unprocessedCount} article(s) not returned by AI - counting as errors`);
                        for (let idx = 0; idx < batch.length; idx++) {
                            if (!processedIndices.has(idx)) {
                                console.log(`      Missing: "${batch[idx].title?.substring(0, 40)}..."`);
                            }
                        }
                        errors += unprocessedCount;
                    }

                } catch (error: any) {
                    console.log(`   ❌ Batch error: ${error.message}`);
                    errors += batch.length;
                }

                // Add delay between batches to avoid rate limiting
                if (i + BATCH_SIZE < allArticles.length) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            console.log(`\n═══════════════════════════════════════════════════════════════`);
            console.log(`🔍 [SOURCE VERIFY] COMPLETE`);
            console.log(`   ✅ Verified: ${verified}`);
            console.log(`   📝 Updated (fixed content): ${flagged}`);
            console.log(`   🗑️ Deleted: ${deleted}`);
            console.log(`   ❌ Errors: ${errors}`);
            console.log(`═══════════════════════════════════════════════════════════════`);

            return { verified, updated: flagged, deleted, errors };
        } finally {
            // Always release the lock, even if there's an error
            await ctx.runMutation(internal.api.releaseSourceVerificationLock, { runId });
        }
    },
});

/**
 * Verify a single article - useful for testing
 */
export const verifySingleSource = internalAction({
    args: {
        url: v.string(),
        storedTitle: v.string(),
        storedSummary: v.string(),
    },
    handler: async (ctx, args): Promise<{ status: string; actualTitle?: string; actualTopic?: string; matchScore?: number; reason: string }> => {
        console.log(`🔍 [SINGLE VERIFY] Checking: ${args.url}`);

        const verificationPrompt = `You are a SOURCE VERIFICATION AGENT.

🔍 YOUR TASK:
1. VISIT this URL: ${args.url}
2. READ the actual content of the page
3. COMPARE against what we have stored:
   - Stored Title: "${args.storedTitle}"
   - Stored Summary: "${args.storedSummary}"
4. DETERMINE if this is a valid article about Thailand-Cambodia relations

OUTPUT FORMAT - Wrap your JSON in <json> tags:
<json>
{
  "status": "VERIFIED|URL_DEAD|CONTENT_MISMATCH|OFF_TOPIC|HALLUCINATED",
  "actualTitle": "What the page actually says",
  "actualTopic": "Brief description of what the article is actually about",
  "matchScore": 85,
  "reason": "Detailed explanation of your determination"
}
</json>

RULES:
- You MUST visit the URL - do not guess
- If you cannot access it, mark it URL_DEAD
- Be honest about whether the stored summary matches the actual content`;

        try {
            const response = await callGhostAPI(verificationPrompt, "fast", 2);

            // Extract JSON
            let jsonStr: string | null = null;
            const tagMatch = response.match(/<json>([\s\S]*?)<\/json>/i);
            if (tagMatch) {
                jsonStr = tagMatch[1].trim();
            }

            if (!jsonStr) {
                return { status: "ERROR", reason: "Failed to parse AI response" };
            }

            return JSON.parse(jsonStr);

        } catch (error: any) {
            console.log(`❌ Verification failed: ${error.message}`);
            return { status: "ERROR", reason: error.message };
        }
    },
});

