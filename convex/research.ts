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

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const startTime = Date.now();
        try {
            const response = await fetch(`${GHOST_API_URL}/v1/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: prompt, model }),
            });

            const duration = Date.now() - startTime;

            if (!response.ok) {
                const errorText = await response.text();
                // Truncate error to avoid log pollution
                const safeError = errorText.substring(0, 200) + (errorText.length > 200 ? "..." : "");
                console.warn(`⚠️ [GHOST API] Error ${response.status} after ${duration}ms`);
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
    debugLabel: string = "GHOST"
): Promise<T | null> {
    let currentPrompt = prompt;
    let modelToUse = initialModel;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let rawResponse = "";
        try {
            console.log(`🤖 [${debugLabel}] Attempt ${attempt}/${maxRetries} (${modelToUse})...`);

            // 1. CALL API
            try {
                // If repair attempt, force fast model for speed unless it's deep research
                const actualModel = attempt > 1 ? "fast" : modelToUse;
                rawResponse = await callGhostAPI(currentPrompt, actualModel, 1);
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

        // Get existing articles to avoid duplicates
        const existing = await ctx.runQuery(internal.api.getExistingTitlesInternal, { country: "cambodia" });
        const existingList: string = existing.map((a: { source: string; title: string; sourceUrl: string }) =>
            `- "${a.title}" (${a.source}) - ${a.sourceUrl}`
        ).join("\n");

        const prompt: string = `You are finding NEWS THAT CAMBODIAN CIVILIANS READ.

🇰🇭 YOUR PERSPECTIVE: You are searching for news as if you were a CAMBODIAN CITIZEN.
Find news articles that Cambodians would see on their local TV, newspapers, and news websites.
This means searching CAMBODIAN news outlets that publish news FOR Cambodians.

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
- Each article MUST have a REAL, working sourceUrl
- Do NOT fabricate URLs - if you can't find any, return empty array
- Focus on what Cambodian media is reporting to its own citizens

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

EXISTING IN DATABASE (skip these):
${existingList || "(none yet)"}

FOCUS:
- What is CAMBODIAN media telling its citizens about the border situation?
- Cambodian government statements and positions
- How Cambodian news frames the conflict
- Local Cambodian perspectives and concerns

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

TRANSLATION REQUIREMENTS:
- Provide NATURAL translations (not machine-translated)
- Thai: ภาษาราชการ (formal Thai)
- Khmer: ភាសាផ្លូវការ (formal Khmer)
- If unsure, leave translation field empty

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
- You can search/think before the tags
- Use English numerals (0-9) only
- Extract EXACT publication date/time from the article page

If no credible news found: <json>{"newArticles": [], "flaggedTitles": []}</json>`;

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

        // Get existing articles to avoid duplicates
        const existing = await ctx.runQuery(internal.api.getExistingTitlesInternal, { country: "thailand" });
        const existingList: string = existing.map((a: { source: string; title: string; sourceUrl: string }) =>
            `- "${a.title}" (${a.source}) - ${a.sourceUrl}`
        ).join("\n");

        const prompt: string = `You are finding NEWS THAT THAI CIVILIANS READ.

🇹🇭 YOUR PERSPECTIVE: You are searching for news as if you were a THAI CITIZEN.
Find news articles that Thais would see on their local TV, newspapers, and news websites.
This means searching THAI news outlets that publish news FOR Thai people.

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
- Each article MUST have a REAL, working sourceUrl
- Do NOT fabricate URLs - if you can't find any, return empty array
- Focus on what Thai media is reporting to its own citizens

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

EXISTING IN DATABASE (skip these):
${existingList || "(none yet)"}

FOCUS:
- What is THAI media telling its citizens about the border situation?
- Thai government statements and positions
- How Thai news frames the conflict
- Local Thai perspectives and concerns

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

TRANSLATION REQUIREMENTS:
- Provide NATURAL translations (not machine-translated)
- Thai: ภาษาราชการ (formal Thai)
- Khmer: ភាសាផ្លូវការ (formal Khmer)
- If unsure, leave translation field empty

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
- You can search/think before the tags
- Use English numerals (0-9) only
- Extract EXACT publication date/time from the article page

If no credible news found: <json>{"newArticles": [], "flaggedTitles": []}</json>`;

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

        // Get existing articles to avoid duplicates
        const existing = await ctx.runQuery(internal.api.getExistingTitlesInternal, { country: "international" });
        const existingList: string = existing.map((a: { source: string; title: string; sourceUrl: string }) =>
            `- "${a.title}" (${a.source}) - ${a.sourceUrl}`
        ).join("\n");

        const prompt: string = `You are finding INTERNATIONAL/NEUTRAL NEWS about the Thailand-Cambodia situation.

🌍 YOUR PERSPECTIVE: You are an OUTSIDE OBSERVER - not Thai, not Cambodian.
Find news from international wire services and global news outlets.
These sources should provide NEUTRAL, BALANCED reporting without favoring either side.

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
- Each article MUST have a REAL, working sourceUrl
- Do NOT fabricate URLs - if you can't find any, return empty array
- Focus on NEUTRAL, OBJECTIVE reporting

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

EXISTING IN DATABASE (skip these):
${existingList || "(none yet)"}

FOCUS:
- Neutral, fact-based reporting
- International community reactions (UN, ASEAN, US, China, Japan)
- Verified casualty figures and humanitarian impact
- Diplomatic efforts and negotiations
- What the OUTSIDE WORLD is being told about this conflict

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

TRANSLATION REQUIREMENTS:
- Provide NATURAL translations (not machine-translated)
- Thai: ภาษาราชการ (formal Thai)
- Khmer: ភាសាផ្លូវការ (formal Khmer)
- If unsure, leave translation field empty

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
- You can search/think before the tags
- Use English numerals (0-9) only
- Extract EXACT publication date/time from the article page

If no credible news found: <json>{"newArticles": [], "flaggedTitles": []}</json>`;

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
                const publishedAt = new Date(article.publishedAt).getTime() || Date.now();

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

                await ctx.runMutation(internal.api.insertArticle, {
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
                addedCount++;
                const credNote = credibilityPenalty > 0 ? ` (adjusted from ${article.credibility || 50})` : "";
                console.log(`   ✅ Added: "${(article.titleEn || article.title || "").substring(0, 50)}..." [${finalCredibility}${credNote}]`);
            }

            if (skippedCount > 0) {
                console.log(`   ⚠️ Skipped ${skippedCount} articles with invalid/missing URLs`);
            }

            // Flag outdated articles
            for (const title of result.flaggedTitles || []) {
                await ctx.runMutation(internal.api.flagArticle, {
                    title,
                    status: "outdated",
                    country,
                });
            }

            console.log(`✅ [${country.toUpperCase()}] Added ${addedCount}, flagged ${(result.flaggedTitles || []).length}`);
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

        // Get articles from ALL THREE perspectives
        const cambodiaArticles: any[] = await ctx.runQuery(internal.api.getNewsInternal, { country: "cambodia", limit: 50 });
        const thailandArticles: any[] = await ctx.runQuery(internal.api.getNewsInternal, { country: "thailand", limit: 50 });
        const internationalArticles: any[] = await ctx.runQuery(internal.api.getNewsInternal, { country: "international", limit: 50 });

        if (cambodiaArticles.length === 0 && thailandArticles.length === 0 && internationalArticles.length === 0) {
            console.log("⚠️ [SYNTHESIS] No articles to synthesize");
            return null;
        }

        const cambodiaList: string = cambodiaArticles.map((a: any) =>
            `- [${a.category}] "${a.title}" (${a.source}, cred:${a.credibility || 50}) - ${a.summary || "No summary"}`
        ).join("\n");

        const thailandList: string = thailandArticles.map((a: any) =>
            `- [${a.category}] "${a.title}" (${a.source}, cred:${a.credibility || 50}) - ${a.summary || "No summary"}`
        ).join("\n");

        const internationalList: string = internationalArticles.map((a: any) =>
            `- [${a.category}] "${a.title}" (${a.source}, cred:${a.credibility || 50}) - ${a.summary || "No summary"}`
        ).join("\n");

        // Get previous analysis for context (MEMORY)
        const prevCambodia = await ctx.runQuery(api.api.getAnalysis, { target: "cambodia" }) as any;
        const prevThailand = await ctx.runQuery(api.api.getAnalysis, { target: "thailand" }) as any;
        const prevNeutral = await ctx.runQuery(api.api.getAnalysis, { target: "neutral" }) as any;

        const memoryContext = `
📜 PREVIOUS ANALYSIS (CONTINUITY CONTEXT):
The following was the previous analysis. You should UPDATE this based on new information, but maintain continuity.
If nothing changed, you can keep similar themes. If the situation escalated, update accordingly.

[PREVIOUS CAMBODIA NARRATIVE]: ${prevCambodia?.officialNarrative || "None"}
[PREVIOUS THAILAND NARRATIVE]: ${prevThailand?.officialNarrative || "None"}
[PREVIOUS NEUTRAL SUMMARY]: ${prevNeutral?.generalSummary || "None"}
[PREVIOUS POSTURE]: Cambodia=${prevCambodia?.militaryPosture}, Thailand=${prevThailand?.militaryPosture}
`;

        const prompt: string = `You are a senior geopolitical analyst providing NEUTRAL, RESPECTFUL summaries of each country's perspective. Your job is to synthesize multiple news sources into a balanced situation report that readers from ALL countries would find fair.

📰 CONTEXT - HOW THESE ARTICLES WERE COLLECTED:
- CAMBODIAN SOURCES: Domestic news that Cambodian civilians read (Fresh News, DAP, VOD, Phnom Penh Post, etc.)
- THAI SOURCES: Domestic news that Thai civilians read (Thai Rath, Matichon, Bangkok Post, etc.)
- INTERNATIONAL SOURCES: Outside observers (Reuters, AP, BBC, Al Jazeera, etc.)

${memoryContext}

🧠 YOUR ANALYSIS APPROACH:
- You can SEARCH THE WEB to verify claims or find additional context
- Compare how different sources frame the same events
- Identify the KEY THEMES and CONCERNS emphasized by each country's media
- Note where different sources emphasize different aspects
- Apply balanced judgment to differing accounts
- You may reference previous analysis for CONTEXT, but evaluate current news on its own merits. If evidence changes, your analysis should change.

⚠️ IMPORTANT - SYMMETRIC CRITICAL ANALYSIS:
- ALL parties in a conflict have incentives to exaggerate successes and minimize losses
- Apply EQUAL skepticism to: (1) Thai government/military, (2) Cambodian government/military, (3) Both domestic media, (4) International media (which may have its own editorial biases)
- NO source type is automatically 'truth' - prioritize claims corroborated by MULTIPLE independent sources regardless of origin
- If sources disagree, NOTE THE DISCREPANCY without assuming either is correct
- BE DIRECT about discrepancies between ANY sources (Thai vs Cambodian, domestic vs international, etc.)
- CALL OUT all sides equally when they exaggerate, omit facts, or use nationalist framing
- DON'T pick sides - acknowledge uncertainty when evidence is conflicting
- For casualty figures: if sources disagree, report the RANGE (e.g., '1-5 reported') rather than picking one number

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
- Thai translations: formal (ภาษาราชการ), grammatically correct
- Khmer translations: formal (ភាសាផ្លូវការ), grammatically correct
- If unsure, leave blank rather than guess wrong

═══════════════════════════════════════════════════════════════
🇰🇭 CAMBODIAN DOMESTIC NEWS (what Cambodians are reading - ${cambodiaArticles.length} articles):
${cambodiaList || "(no articles)"}

🇹🇭 THAI DOMESTIC NEWS (what Thais are reading - ${thailandArticles.length} articles):
${thailandList || "(no articles)"}

🌍 INTERNATIONAL NEWS (outside perspective - ${internationalArticles.length} articles):
${internationalList || "(no articles)"}
═══════════════════════════════════════════════════════════════

🎖️ MILITARY POSTURE & INTENSITY GAUGE - SCORING GUIDE:
This is NOT just "how aggressive is the military." It evaluates the NATURE and LOCATION of military actions.

⚔️ POSTURE (nature of the military stance):
- PEACEFUL (0-30): No significant military presence, normal operations, diplomatic channels open
- DEFENSIVE (31-65): Reinforcing own borders, moving troops to defensive positions, reacting to threats
- AGGRESSIVE (66-100): Actively incurring, initiating fire, advancing into disputed/foreign territory

📊 INTENSITY (0-100) EXAMPLES:
0-15: Peacetime (normal border patrols, routine operations)
16-30: Heightened Alert (troops moved to border, but no confrontation)
31-45: Active Defense (responding to incursions, fortifying positions)
46-60: Tense Standoff (troops facing each other, small skirmishes)
61-75: Active Clashes (confirmed firefights, casualties)
76-90: Major Offensive (coordinated attacks, territory seized)
91-100: Full-scale War

🏷️ POSTURE LABEL - MUST BE SHORT (MAX 4 WORDS):
- Combined action + location (e.g., "Airstrikes in Border Zone")
- MUST be under 30 characters if possible to fit in UI badge.
Examples:
  - "Routine Border Patrol"
  - "Defensive Reinforcement"
  - "Artillery Response"
  - "Airstrikes into Cambodia"
  - "Incursion into Disputed Zone"
  - "Troops on Foreign Soil"

💡 KEY QUESTIONS TO DETERMINE POSTURE:
1. WHO moved first? (Initiator vs Responder)
2. WHERE is the action? (Their territory, disputed zone, or our territory?)
3. WHAT is the goal? (Defend, Deter, or Expand?)

If Country A's troops are in Country B's territory → A is likely AGGRESSIVE
If Country A is responding to intrusion in their own land → A is likely DEFENSIVE

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
    "generalSummary": "3-4 sentences. Synthesized view from ALL sources (not just international).",
    "generalSummaryEn": "English version",
    "generalSummaryTh": "Thai translation",
    "generalSummaryKh": "Khmer translation",
    "conflictLevel": "Low|Elevated|Critical|Uncertain",
    "keyEvents": ["Event 1", "Event 2"],
    "keyEventsEn": ["Event 1 EN"],
    "keyEventsTh": ["เหตุการณ์ 1"],
    "keyEventsKh": ["ព្រឹត្តិការណ៍ 1"],
    "discrepancies": "Where do different reports differ? Note disputed claims.",
    "confidence": 75,
    "confidenceRationale": "How sure are we? What's uncertain?"
  }
}
</json>

RULES:
- You MUST include <json> and </json> tags
- Inside the tags, output valid JSON only
- You can analyze/think before the tags
- Use English numerals (0-9) only`;

        try {
            // Use generic self-healing helper
            const result = await callGhostWithSelfHealing<{
                cambodia: any;
                thailand: any;
                neutral: any;
            }>(prompt, "thinking", 3, "SYNTHESIS");

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
                    militaryIntensity: Math.max(0, Math.min(100, result.cambodia.militaryIntensity || 50)),
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
                    militaryIntensity: Math.max(0, Math.min(100, result.thailand.militaryIntensity || 50)),
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
        // Note: isPaused check removed - pause only affects automatic cron (which is disabled)
        // Manual runs via npx convex run always execute

        console.log("═══════════════════════════════════════════════════════════════");
        console.log("🔄 RESEARCH CYCLE STARTED");
        console.log("═══════════════════════════════════════════════════════════════");

        await ctx.runMutation(internal.api.setStatus, { status: "syncing" });

        const errors: string[] = [];

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

        // Step 2: Validation Loop
        console.log("\n── STEP 2: VALIDATION LOOP ──");
        try {
            await ctx.runAction(internal.validation.runValidationLoop, {});
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2s cooler
        } catch (e) {
            console.error("❌ [STEP 2] Validation Failed:", e);
            errors.push(`Validation: ${String(e)}`);
        }

        // Step 3: Dashboard Update (SKIPPED - User runs manually)
        // console.log("\n── STEP 3: DASHBOARD UPDATE ──");
        // try {
        //     await ctx.runAction(internal.research.updateDashboard, {});
        //     await new Promise(resolve => setTimeout(resolve, 2000)); // 2s cooler
        // } catch (e) {
        //     console.error("❌ [STEP 3] Dashboard Update Failed:", e);
        //     errors.push(`Dashboard: ${String(e)}`);
        // }

        // Step 4: Combined Synthesis (Uses "Memory" of previous state)
        console.log("\n── STEP 4: SYNTHESIS ──");
        try {
            await ctx.runAction(internal.research.synthesizeAll, {});
        } catch (e) {
            console.error("❌ [STEP 4] Synthesis Failed:", e);
            errors.push(`Synthesis: ${String(e)}`);
        }

        // Final Status Update
        if (errors.length === 0) {
            await ctx.runMutation(internal.api.setStatus, { status: "online" });
            console.log("═══════════════════════════════════════════════════════════════");
            console.log("✅ RESEARCH CYCLE COMPLETE (SUCCESS)");
            console.log("═══════════════════════════════════════════════════════════════");
        } else {
            console.log("═══════════════════════════════════════════════════════════════");
            console.log("⚠️ RESEARCH CYCLE COMPLETE (WITH ERRORS)");
            console.log("Errors encountered:", errors);
            console.log("═══════════════════════════════════════════════════════════════");
            // If at least one thing succeeded, we stay online but maybe log the error elsewhere?
            // For now, let's just go back to online so the next cycle can try again.
            // Only set error status if it was catastrophic (e.g. all failed), but for now 'online' to keep the heartbeat.
            await ctx.runMutation(internal.api.setStatus, { status: "online", errorLog: errors.join(" | ") });
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

        const prevStats = await ctx.runQuery(api.api.getDashboardStats, {}) as any;

        const memoryContext = `
📊 CURRENT DASHBOARD STATS (from previous update):
Conflict Level: ${prevStats?.conflictLevel || "UNKNOWN"}
Casualties: ${prevStats?.casualtyCount || 0}
Displaced: ${prevStats?.displacedCount || 0} (Trend: ${prevStats?.displacedTrend || 0}%)
Civilian Injured: ${prevStats?.civilianInjuredCount || 0}
Military Injured: ${prevStats?.militaryInjuredCount || 0}

⚠️ IMPORTANT - REGARDING UPDATES:
- These numbers may ALREADY be accurate and up-to-date
- You are NOT required to change numbers on every update
- If your research shows the situation hasn't changed, RETURN THE SAME NUMBERS
- Only update if you find NEW, VERIFIED information that differs from current stats
- It's better to keep stable numbers than to make random changes without evidence
- DO NOT invent changes just to show activity - accuracy matters more than updates
`;


        const prompt = `You are the DASHBOARD CONTROLLER for the BorderClash monitor.
Your job is to SEARCH THE WEB in MULTIPLE LANGUAGES and cross-reference sources to establish accurate metrics.

${memoryContext}

🌐 MULTI-LANGUAGE RESEARCH (SEARCH IN ALL THREE):
1. ENGLISH: "Thailand Cambodia border clash casualties", "Preah Vihear conflict displaced", "border shelling deaths"
2. THAI: "ไทย กัมพูชา ปะทะ ชายแดน ผู้บาดเจ็บ", "อพยพ พระวิหาร", "ทหารไทย เสียชีวิต"
3. KHMER: "ការប៉ះទង្គិច ព្រំដែន ប្រទេសថៃ កម្ពុជា", "ប្រជាជនភៀសខ្លួន", "ស្លាប់ របួស"

**SEARCH BROADLY - use ANY credible sources you find, not just these examples.**
** You are NOT limited to these sources - use your judgment to find the most reliable information:**
**Prioritize international wire services (Reuters, AP, AFP) as baseline, but verify with local sources too.**

📰 EXAMPLE SOURCES (prioritize these, but search broadly):
INTERNATIONAL (baseline - most neutral):
- Wire services: Reuters, AP, AFP
- Global news: BBC, Al Jazeera, CNN, Guardian

THAI SOURCES (for Thai perspective):
- Bangkok Post, Thai PBS, Matichon, ThaiRath, Khaosod

CAMBODIAN SOURCES (for Cambodian perspective):
- Phnom Penh Post, Fresh News, Khmer Times, VOD, RFA Khmer

OFFICIAL (use with skepticism - governments have agendas):
- Royal Thai Army (RTA), Thai Ministry of Defense
- Royal Cambodian Armed Forces (RCAF), Cambodian Ministry of National Defense
- UN/ASEAN statements

📊 REQUIRED METRICS - TRIANGULATE FROM MULTIPLE SOURCES:
1. CONFLICT LEVEL (use UPPERCASE):
   - "LOW": No kinetic action, only diplomatic words
   - "ELEVATED": Troop movements, drills, minor skirmishes, evacuations
   - "CRITICAL": Sustained shelling, confirmed fatalities, major offensive
   - "UNCERTAIN": Conflicting reports, cannot determine with confidence

2. STATS - CROSS-CHECK AND MAKE BEST ESTIMATE:
   - displaced: Cross-check Thai + Cambodian + International numbers, make your BEST ESTIMATE
   - displacedTrend: PERCENTAGE CHANGE from 1 week ago (e.g., +300 means 300% increase, -50 means 50% decrease)
   - fatalities: Make your BEST ESTIMATE based on all available sources
   - civilianInjured: Separate civilian injuries
   - militaryInjured: Separate military injuries

⚠️ SYMMETRIC ACCURACY RULES:
- ALL sources (Thai, Cambodian, International) may have biases - treat them equally
- If sources give DIFFERENT numbers, make your BEST EDUCATED ESTIMATE (not just the lowest)
- Weight sources by how many independent reports corroborate a claim
- Single-source claims should be noted with lower confidence
- DO NOT HALLUCINATE - if you cannot verify, return 0 with low confidence
- If uncertain, set confidence LOW and explain in confidenceRationale

Wrap your response in <json> tags:
<json>
{
  "conflictLevel": "LOW",
  "confidence": 75,
  "confidenceRationale": "Based on X sources agreeing, Y sources disagree on...",
  "stats": {
    "displaced": 0,
    "displacedTrend": 0,
    "fatalities": 0,
    "civilianInjured": 0,
    "militaryInjured": 0
  }
}
</json>

RULES:
- You MUST include <json> and </json> tags
- Inside the tags, output valid JSON only
- You can analyze before the tags
- Use English numerals (0-9) only`;

        interface DashboardData {
            conflictLevel?: string;
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
            console.log("✅ [DASHBOARD] Parsed data:", data);

            // 3. Update Database (NEW: dashboardStats table, NOT neutralAnalysis)
            await ctx.runMutation(internal.api.upsertDashboardStats, {
                conflictLevel: data.conflictLevel || "LOW",
                displacedCount: data.stats?.displaced || 0,
                displacedTrend: data.stats?.displacedTrend || 0,
                casualtyCount: data.stats?.fatalities || 0,
                civilianInjuredCount: data.stats?.civilianInjured || 0,
                militaryInjuredCount: data.stats?.militaryInjured || 0,
            });

            console.log("💾 [DASHBOARD] Database updated successfully.");

        } catch (error) {
            console.error("❌ [DASHBOARD] Update failed:", error);
        }
    }
});

