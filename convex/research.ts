"use node";

import { internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";

// Use gemini-studio-api helpers
import { MODELS, FALLBACK_CHAINS } from "./config";
import { callGeminiStudio, callGeminiStudioWithSelfHealing, callGeminiStudioWithFallback, formatTimelineEvent } from "./ai_utils";


// =============================================================================
// SHARED UTILS (deprecated Ghost API endpoints removed)
// =============================================================================

// =============================================================================
// ADAPTIVE SCHEDULER: Heartbeat that checks if it's time to run
// This runs every 4 hours and checks nextRunAt to decide if full cycle should run
// =============================================================================
export const maybeRunCycle = internalAction({
    args: {},
    handler: async (ctx): Promise<{ skipped: boolean; reason?: string; ran?: boolean }> => {
        console.log("⏰ [SCHEDULER] Heartbeat check...");

        const stats = await ctx.runQuery(internal.api.getSystemStatsInternal, {});
        const now = Date.now();

        // If system is paused, skip
        if (stats?.isPaused) {
            console.log("⏸️ [SCHEDULER] System is paused, skipping");
            return { skipped: true, reason: "paused" };
        }

        // If skipNextCycle is set, skip this one and clear the flag
        if (stats?.skipNextCycle) {
            console.log("⏭️ [SCHEDULER] Skip flag set, skipping this cycle");
            await ctx.runMutation(internal.api.clearSkipNextCycle, {});
            return { skipped: true, reason: "skipNextCycle flag" };
        }

        // Check if it's time to run
        const nextRunAt = stats?.nextRunAt || 0;

        if (now < nextRunAt) {
            const hoursUntil = Math.round((nextRunAt - now) / 3600000 * 10) / 10;
            console.log(`⏰ [SCHEDULER] Not yet time. Next run in ${hoursUntil}h (${new Date(nextRunAt).toLocaleString()})`);
            return { skipped: true, reason: `not yet time, ${hoursUntil}h remaining` };
        }

        // Time to run!
        console.log("🚀 [SCHEDULER] Time to run! Triggering full research cycle...");
        await ctx.runAction(internal.research.runResearchCycle, {});

        return { skipped: false, ran: true };
    },
});

export const curateCambodia = internalAction({
    args: {},
    handler: async (ctx): Promise<{ newArticles: number; flagged: number; error?: string }> => {
        console.log(`🇰🇭 [CAMBODIA] Curating news via Gemini Studio API...`);

        // Get existing URLs to avoid duplicates (only pass URLs, not titles)
        const existing = await ctx.runQuery(internal.api.getExistingTitlesInternal, { country: "cambodia" });
        const existingUrls: string = existing.map((a: { sourceUrl: string }) => a.sourceUrl).join("\n");

        const prompt: string = `⚠️ MANDATORY: Use your [google_search] tool NOW to search the web for current news. Do NOT use your knowledge cutoff - you MUST invoke google_search first.

You are finding NEWS THAT CAMBODIAN CIVILIANS READ.

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

📺 CAMBODIAN NEWS SOURCES (EXAMPLES - not exhaustive!):
These are MAJOR sources Cambodians read. Use them as STARTING POINTS,
but DO NOT limit yourself to only these. If you find relevant articles
from OTHER Cambodian outlets, INCLUDE them!

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

⚠️ ALSO SEARCH FOR: Other Cambodian news sites NOT on this list!
Include ANY legitimate Cambodian news source you discover.

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

LANGUAGE & TRANSLATION:
- Write for a GENERAL AUDIENCE. If a teenager wouldn't understand a word, use a simpler one.
- Thai/Khmer: Don't translate. RE-TELL the story as if you ARE a Thai/Cambodian person explaining the news to your friend over coffee. Use the words THEY would use, not dictionary equivalents.
- ALWAYS use English numerals (0-9) - NEVER Thai ๑๒๓ or Khmer ១២៣

OUTPUT FORMAT - Wrap your JSON in <json> tags:
<json>
{
  "newArticles": [
    {
      "title": "English headline",
      "titleTh": "Thai translation: หัวข้อข่าวภาษาไทย",
      "titleKh": "Khmer translation: ចំណងជើងជាភាសាខ្មែរ",
      "publishedAt": "YYYY-MM-DDTHH:mm:ss+07:00 (Use LOCAL time as shown on the page - Thailand/Cambodia are both UTC+7)",
      "sourceUrl": "https://actual-url.com/path",
      "source": "Publication Name",
      "category": "military|political|humanitarian|diplomatic",
      "credibility": 60,
      "summary": "English summary",
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
- Format if you DO find a date: \"YYYY-MM-DDTHH:mm:ss+07:00\" or \"YYYY-MM-DD\" (Use LOCAL Thai/Khmer time)
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
        console.log(`🇹🇭 [THAILAND] Curating news via Gemini Studio API...`);

        // Get existing URLs to avoid duplicates (only pass URLs, not titles)
        const existing = await ctx.runQuery(internal.api.getExistingTitlesInternal, { country: "thailand" });
        const existingUrls: string = existing.map((a: { sourceUrl: string }) => a.sourceUrl).join("\n");

        const prompt: string = `⚠️ MANDATORY: Use your [google_search] tool NOW to search the web for current news. Do NOT use your knowledge cutoff - you MUST invoke google_search first.

You are finding NEWS THAT THAI CIVILIANS READ.

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

📺 THAI NEWS SOURCES (EXAMPLES - not exhaustive!):
These are MAJOR sources Thais read. Use them as STARTING POINTS,
but DO NOT limit yourself to only these. If you find relevant articles
from OTHER Thai outlets, INCLUDE them!

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

⚠️ ALSO SEARCH FOR: Other Thai news sites NOT on this list!
Include ANY legitimate Thai news source you discover.

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

LANGUAGE & TRANSLATION:
- Write for a GENERAL AUDIENCE. If a teenager wouldn't understand a word, use a simpler one.
- Thai/Khmer: Don't translate. RE-TELL the story as if you ARE a Thai/Cambodian person explaining the news to your friend over coffee. Use the words THEY would use, not dictionary equivalents.
- ALWAYS use English numerals (0-9) - NEVER Thai ๑๒๓ or Khmer ១២៣

OUTPUT FORMAT - Wrap your JSON in <json> tags:
<json>
{
  "newArticles": [
    {
      "title": "English headline",
      "titleTh": "Thai translation: หัวข้อข่าวภาษาไทย",
      "titleKh": "Khmer translation: ចំណងជើងជាភាសាខ្មែរ",
      "publishedAt": "YYYY-MM-DDTHH:mm:ss+07:00 (Use LOCAL time as shown on the page - Thailand is UTC+7)",
      "sourceUrl": "https://actual-url.com/path",
      "source": "Publication Name",
      "category": "military|political|humanitarian|diplomatic",
      "credibility": 60,
      "summary": "English summary",
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
- Format if you DO find a date: \"YYYY-MM-DDTHH:mm:ss+07:00\" or \"YYYY-MM-DD\" (Use LOCAL Thai time)
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
        console.log(`🌍 [INTERNATIONAL] Curating news via Gemini Studio API...`);

        // Get existing URLs to avoid duplicates (only pass URLs, not titles)
        const existing = await ctx.runQuery(internal.api.getExistingTitlesInternal, { country: "international" });
        const existingUrls: string = existing.map((a: { sourceUrl: string }) => a.sourceUrl).join("\n");

        const prompt: string = `⚠️ MANDATORY: Use your [google_search] tool NOW to search the web for current news. Do NOT use your knowledge cutoff - you MUST invoke google_search first.

You are finding INTERNATIONAL/NEUTRAL NEWS about the Thailand-Cambodia situation.

🌍 YOUR PERSPECTIVE: You are an OUTSIDE OBSERVER - not Thai, not Cambodian.
Find news from international wire services and global news outlets.
These sources should provide NEUTRAL, BALANCED reporting without favoring either side.

⛔⛔⛔ CRITICAL ANTI-HALLUCINATION RULES ⛔⛔⛔
🚫 DO NOT FABRICATE URLS - Every URL you return MUST be a real page you actually found via search
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

📺 INTERNATIONAL SOURCES (EXAMPLES - not exhaustive!):
These are well-known international outlets. Use them as STARTING POINTS,
but DO NOT limit yourself to only these. If you find relevant articles
from OTHER international sources, INCLUDE them!

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

⚠️ ALSO SEARCH FOR: Other international news sites NOT on this list!
Include ANY legitimate international news source covering this conflict.

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

LANGUAGE & TRANSLATION:
- Write for a GENERAL AUDIENCE. If a teenager wouldn't understand a word, use a simpler one.
- Thai/Khmer: Don't translate. RE-TELL the story as if you ARE a Thai/Cambodian person explaining the news to your friend over coffee. Use the words THEY would use, not dictionary equivalents.
- ALWAYS use English numerals (0-9) - NEVER Thai ๑๒๓ or Khmer ១២๣

OUTPUT FORMAT - Wrap your JSON in <json> tags:
<json>
{
  "newArticles": [
    {
      "title": "English headline",
      "titleTh": "Thai translation: หัวข้อข่าวภาษาไทย",
      "titleKh": "Khmer translation: ចំណងជើងជាភាសាខ្មែរ",
      "publishedAt": "YYYY-MM-DDTHH:mm:ss+07:00 (Use LOCAL time - convert to Thailand/Cambodia time UTC+7)",
      "sourceUrl": "https://actual-url.com/path",
      "source": "Publication Name",
      "category": "military|political|humanitarian|diplomatic",
      "credibility": 85,
      "summary": "English summary",
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
- Format if you DO find a date: \"YYYY-MM-DDTHH:mm:ss+07:00\" or \"YYYY-MM-DD\" (Convert to Thai/Khmer local time)
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
            console.log(`🤖 [${country.toUpperCase()}] Attempt ${attempt}/${MAX_RETRIES} (Model: curation)...`);

            // 1. CALL API - Using curation model mapping
            rawResponse = await callGeminiStudio(currentPrompt, MODELS.fast, 1);

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

            // DEBUG: Log what AI actually returned
            console.log(`📋 [${country.toUpperCase()}] AI returned ${articles.length} articles in JSON`);
            if (articles.length === 0) {
                console.log(`📄 [${country.toUpperCase()}] Raw response preview: ${rawResponse.substring(0, 500)}...`);
            }

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
            // Add delay for network errors to give Cloudflare tunnel time to reconnect
            if (attempt < MAX_RETRIES) {
                console.log(`⏳ [${country.toUpperCase()}] Waiting 8s before retry...`);
                await new Promise(resolve => setTimeout(resolve, 8000));
            }
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
        const timeline = await ctx.runQuery(internal.api.getRecentTimeline, { limit: 100 });
        const timelineStats = await ctx.runQuery(internal.api.getTimelineStats, {});

        console.log(`📜 Timeline: ${timeline.length} events (avg importance: ${timelineStats.avgImportance})`);

        // Build timeline context using shared helper
        const timelineContext = timeline.length > 0
            ? timeline.map((e: any) => formatTimelineEvent(e)).join("\n\n")
            : "(No timeline events yet)";

        // ==================== STRATIFIED ARTICLE SAMPLING ====================
        // Timeline has verified/credible sources, so we DON'T need high-cred articles again.
        // Instead we focus on:
        // 1. LOW CREDIBILITY (propaganda) - to analyze what each side is lying about
        // 2. BREAKING NEWS (most recent) - to catch current developments
        // This keeps context bounded even as DB grows to 1000s of articles.

        // PHASE 2 OPTIMIZATION: Use specialized indexed queries instead of fetching 300 articles
        // This reduces bandwidth by ~75-80% by fetching exactly what we need

        // ==================== LOW CREDIBILITY / PROPAGANDA (15 per country) ====================
        // Use new indexed query that sorts by credibility at database level
        const [cambodiaLowCred, thailandLowCred, internationalLowCred] = await Promise.all([
            ctx.runQuery(internal.api.getLowCredArticles, { country: "cambodia", limit: 15 }),
            ctx.runQuery(internal.api.getLowCredArticles, { country: "thailand", limit: 15 }),
            ctx.runQuery(internal.api.getLowCredArticles, { country: "international", limit: 15 }),
        ]);

        if (cambodiaLowCred.length === 0 && thailandLowCred.length === 0 && internationalLowCred.length === 0 && timeline.length === 0) {
            console.log("⚠️ [SYNTHESIS] No articles or timeline events to synthesize");
            return null;
        }

        // Helper to format article for prompt - numbered for better AI tracking
        const formatArticle = (a: any, idx: number) =>
            `${idx + 1}. [${a.category}] "${a.title}" (${a.source}, cred:${a.credibility || 50})
   URL: ${a.sourceUrl || "(none)"}
   Summary: ${a.summary || "No summary"}`;

        const cambodiaPropaganda = cambodiaLowCred.map((a: any, i: number) => formatArticle(a, i)).join("\n");
        const thailandPropaganda = thailandLowCred.map((a: any, i: number) => formatArticle(a, i)).join("\n");
        const internationalPropaganda = internationalLowCred.map((a: any, i: number) => formatArticle(a, i)).join("\n");

        console.log(`📰 [SYNTHESIS] Low-cred articles: Cambodia=${cambodiaLowCred.length}, Thailand=${thailandLowCred.length}, Intl=${internationalLowCred.length}`);

        // ==================== BREAKING NEWS (30 most recent across all) ====================
        // Use new indexed query that fetches from all tables and sorts by publishedAt
        const breakingNews: any[] = await ctx.runQuery(internal.api.getRecentBreakingNews, { limit: 30 });

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
        const prevStats = await ctx.runQuery(api.api.getDashboardStats, {}) as any;

        const memoryContext = `
📜 TIMELINE (VERIFIED HISTORICAL RECORD - ${timeline.length} events):
This is the structured memory of key conflict events. Use this as your PRIMARY source of truth.
${timelineContext}

📜 PREVIOUS ANALYSIS (CONTINUITY CONTEXT):
The following was the previous analysis. Think of this as your last report - you're updating it, not starting from scratch.

⚠️ CRITICAL: DON'T BLINDLY FOLLOW THE OLD ANALYSIS!
The previous synthesis might be outdated, flawed, or based on limited information. YOU MUST:
- **Evaluate independently**: Look at the CURRENT timeline and articles. What do THEY tell you?
- **Challenge the old narrative**: Does it still match the evidence? Or was it based on a bias/misreading?
- **Don't auto-continue storylines**: Just because the previous analysis said "escalating tension" doesn't mean you should keep saying that if current evidence shows otherwise.
- **Think for yourself**: The previous analysis is ONE data point. The timeline and articles are your PRIMARY evidence.

🔄 ITERATION GUIDANCE:
- **If the situation is essentially unchanged**: Keep the core narrative and make only minor refinements (update phrasing, add nuance, adjust intensity slightly). You don't need to manufacture a new story every cycle.
- **If there's genuinely new information**: Incorporate it smoothly. Evolve the narrative rather than replacing it entirely.
- **If major developments contradict previous analysis**: Update boldly and explain the shift.
- **Think evolution, not revolution**: Most cycles involve gradual adjustments, not complete rewrites.

Your job is to maintain an accurate, **evolving** narrative - not to create drama where none exists, and not to perpetuate errors from previous cycles.

[PREVIOUS CAMBODIA NARRATIVE]: ${prevCambodia?.officialNarrative || "None"}
[PREVIOUS THAILAND NARRATIVE]: ${prevThailand?.officialNarrative || "None"}
[PREVIOUS NEUTRAL SUMMARY]: ${prevNeutral?.generalSummary || "None"}
[PREVIOUS POSTURE]: Cambodia=${prevCambodia?.militaryPosture}, Thailand=${prevThailand?.militaryPosture}
`;

        const prompt: string = `You are a senior geopolitical analyst providing NEUTRAL but SHARP analysis. You have TWO roles:

💡 TIP: You have the [google_search] tool available. If current news articles don't provide enough clarity or if you need to verify a specific claim, feel free to use it to search for the most recent context.

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

📐 RULE 3: CONFIDENCE REFLECTS SOURCE QUALITY
Confidence scores should reflect ACTUAL source quality and information availability — do NOT force artificial parity.
- If one side has better verified coverage (more wire services, more independent reporters), that side CAN have higher confidence
- Large gaps (>15 points) MUST be explained in confidenceRationale
- Hiding genuine information asymmetry IS a form of bias — report reality

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

🌐 LANGUAGE & TRANSLATION:
- Write for a GENERAL AUDIENCE. If a teenager wouldn't understand a word, use a simpler one.
- Thai/Khmer: Don't translate. RE-TELL the story as if you ARE a Thai/Cambodian person explaining the news to your friend over coffee. Use the words THEY would use, not dictionary equivalents.
- ALWAYS use English numerals (0-9) in translations - NEVER Thai ๑๒๓ or Khmer ១២៣

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
This gauge measures whether a party is DEFENDING, ESCALATING, or ATTACKING.
The bar position MUST match the posture category.

⚔️ POSTURE & INTENSITY (these MUST match!):
🟢 PEACEFUL (intensity: 0-30): No military threat, normal operations, diplomacy active
   - 0-10: Complete peace, minimal military presence
   - 11-20: Normal patrols, routine operations
   - 21-30: Heightened awareness, but no military action

🟡 DEFENSIVE (intensity: 31-55): Protecting own position, responding to threats
   - 31-40: Reinforcing positions, moving to defensive posture
   - 41-50: Active defense, fortifying against incursion
   - 51-55: Heavy defensive action (returning fire, repelling attack)

🟠 ESCALATED (intensity: 56-69): Mobilizing, posturing, preparing for potential offensive
   - 56-60: Troop buildups, forward deployments, ultimatums issued
   - 61-65: Artillery/assets moved to striking positions
   - 66-69: Imminent attack posture, provocations, cross-border probing

🔴 AGGRESSIVE (intensity: 70-100): Attacking, invading, or initiating combat
   - 70-80: Cross-border strikes, entering contested areas
   - 81-90: Active offensive operations, seizing ground
   - 91-100: Full-scale offensive

⚠️ CRITICAL RULES:
   - If posture is PEACEFUL → intensity must be 0-30
   - If posture is DEFENSIVE → intensity must be 31-55
   - If posture is ESCALATED → intensity must be 56-69
   - If posture is AGGRESSIVE → intensity must be 70-100
   - BOTH-SIDES RULE: Both parties CAN have the same posture. Assign intensity based on scale/severity of each side's actions independently.

🏷️ POSTURE LABEL - MUST BE SHORT (MAX 6 WORDS):
Examples by posture:
  PEACEFUL: "Routine Patrols", "Normal Operations", "Diplomatic Talks"
  DEFENSIVE: "Border Reinforcement", "Defensive Positions", "Repelling Attack"
  ESCALATED: "Troop Mobilization", "Forces Massing", "Preparing Offensive"
  AGGRESSIVE: "Cross-Border Strike", "Territory Seizure", "Offensive Underway"

💡 ACTION-BASED ASSESSMENT (focus on WHAT parties DO, not territorial claims):
- WHO MOVED FORWARD this cycle? → Moving toward the other side = more aggressive
- WHO FIRED FIRST in engagements? → Initiating fire = more aggressive
- WHO IS STATIONARY vs ADVANCING? → Holding position = more defensive
- SCALE OF OPERATIONS: Airstrikes/artillery > ground incursions > defensive fire
- If both sides claim self-defense, focus on WHO INITIATED the specific engagement being analyzed

🛡️ VERIFICATION & ACCURACY RULES:
1. NO SPECIFICITY WITHOUT SOURCE: Do NOT invent specific names (e.g., specific hill numbers, bridge names, or unit IDs) unless EXPLICITLY present in the source text. Use general terms like "high ground" or "infrastructure" if unsure.
2. PRECISE LANGUAGE: Distinguish between "rejecting a PROPOSAL" vs "rejecting a CLAIM". If a source says "We deny X happened", report it as a DENIAL, not a refusal of peace.
3. PLATFORM VERIFICATION: Do not specify weapon platforms (e.g., "Naval shelling", "F-16s") unless high-credibility sources confirm them. Use "airstrikes" or "shelling" if the specific platform is unconfirmed.
4. POLICY VS REALITY: Distinguish between official policy (e.g., "border closed by decree") and tactical reality (e.g., "crossing impassable due to fighting").

📰 KEY EVENTS STYLE GUIDE - SMART SPACE MANAGEMENT:
Write KEY EVENTS as SHORT headline-style bullets. MAX 12 WORDS each!

⚖️ BALANCE SUMMARY LENGTH vs. NUMBER OF POINTS:
The neutral card has LIMITED TOTAL SPACE. You must balance these two elements:
- **If your summary is LONG (70+ words)**: Use FEWER key events (2-3 points max)
- **If your summary is SHORT (50-60 words)**: You can use MORE key events (4-5 points)
- **Think total card density**: Long text + many bullets = overload. Keep it scannable!

❌ TOO LONG: "Country A announces 'Ceasefire', but fighting intensifies hours later as Country B rejects the truce"
❌ TOO LONG: "Humanitarian Crisis: 330,000+ civilians displaced as borders close"
✅ GOOD: "Ceasefire collapses hours after announcement"
✅ GOOD: "Airstrikes hit key bridge; rockets fired in response"
✅ GOOD: "330,000+ civilians displaced; borders closed"
✅ GOOD: "Both sides claim self-defense at UN"

Be CONCISE. Each event = 1 short line. No multi-clause sentences. Frame events NEUTRALLY - don't imply who "started it" unless clearly established.

📏 LENGTH HIERARCHY (IMPORTANT!):
- SIDE CARDS (Cambodia/Thailand): COMPACT. 2-3 sentences, max 50 words. These cards have limited space. Report key claims CONCISELY - just the essence of what their media is saying.
- CENTER CARD (Neutral): LONGEST but BOUNDED. 3-5 sentences, 50-80 words for summary. You are the REFEREE here - summarize BOTH sides' actions, call out discrepancies, give the full picture. Remember to balance with key events!

ANALYZE ALL PERSPECTIVES. Wrap your JSON response in <json> tags:
<json>
{
  "cambodia": {
    "officialNarrative": "English (2-3 sentences, max 50 words). Key claims from Cambodian media only.",
    "officialNarrativeTh": "Thai translation",
    "officialNarrativeKh": "Khmer translation",
    "narrativeSource": "Primary source(s)",
    "militaryIntensity": 50,
    "militaryPosture": "PEACEFUL|DEFENSIVE|ESCALATED|AGGRESSIVE",
    "postureLabel": "Short phrase (max 4 words)",
    "postureLabelTh": "Thai translation",
    "postureLabelKh": "Khmer translation",
    "postureRationale": "English 1-2 sentences. WHY this posture? Focus on actions, not sources.",
    "postureRationaleTh": "Thai translation",
    "postureRationaleKh": "Khmer translation",
    "biasNotes": "Key themes emphasized",
    "confidence": 75,
    "confidenceRationale": "Brief justification"
  },
  "thailand": {
    "officialNarrative": "English (2-3 sentences, max 50 words). Key claims from Thai media only.",
    "officialNarrativeTh": "Thai translation",
    "officialNarrativeKh": "Khmer translation",
    "narrativeSource": "Primary source(s)",
    "militaryIntensity": 50,
    "militaryPosture": "PEACEFUL|DEFENSIVE|ESCALATED|AGGRESSIVE",
    "postureLabel": "Short phrase (max 4 words)",
    "postureLabelTh": "Thai translation",
    "postureLabelKh": "Khmer translation",
    "postureRationale": "English 1-2 sentences. WHY this posture? Focus on actions, not sources.",
    "postureRationaleTh": "Thai translation",
    "postureRationaleKh": "Khmer translation",
    "biasNotes": "Key themes emphasized",
    "confidence": 75,
    "confidenceRationale": "Brief justification"
  },
  "neutral": {
    "generalSummary": "English (3-5 sentences, 50-80 words). Summarize BOTH sides' key actions, humanitarian impact, diplomatic developments. Compare claims. Note where sources agree/disagree. Be the impartial commentator giving the full picture.",
    "generalSummaryTh": "Thai translation",
    "generalSummaryKh": "Khmer translation",
    "conflictLevel": "Low|Elevated|Critical|Uncertain",
    "keyEvents": [
      "2-5 SHORT English headlines (adjust based on summary length!)",
      "MAX 12 words each - use NEUTRAL framing",
      "If summary is 70+ words, use only 2-3 events",
      "If summary is 50-60 words, can use 4-5 events"
    ],
    "keyEventsTh": ["หัวข้อสั้นๆ ไม่เกิน 12 คำ"],
    "keyEventsKh": ["ចំណងជើងខ្លី មិនលើស 12 ពាក្យ"],
    "discrepancies": "List SPECIFIC contradictions. Use SYMMETRIC language: 'Country A claims X, Country B claims Y, international sources suggest Z'. ATTRIBUTE the 'believable' version to a NAMED source (Reuters, ICRC, etc), don't just pick one.",
    "confidence": 75,
    "confidenceRationale": "Must justify if Cambodia/Thailand confidence differs by >10 points. What's verified? What's propaganda from EACH side?"
  },
  "scheduling": {
    "nextCycleHours": 12,
    "reason": "Brief 1-sentence explanation. Example: 'Peaceful conditions, both sides defensive, no major developments'"
  },
  "dashboard": {
    "conflictLevel": "LOW|ELEVATED|CRITICAL|UNCERTAIN",
    "casualtyCount": 0,
    "displacedCount": 0,
    "civilianInjuredCount": 0,
    "militaryInjuredCount": 0,
    "unchanged": true,
    "changeReason": "Brief explanation of why stats changed or stayed same"
  }
}
</json>

📊 DASHBOARD STATS RULES (in the "dashboard" section):
These are the LIVE STATS shown on the dashboard. Be CONSERVATIVE - only change if you have NEW verified evidence.

CONFLICT LEVEL:
- "LOW": No kinetic action, only diplomatic words
- "ELEVATED": Troop movements, drills, minor skirmishes, small-scale evacuations
- "CRITICAL": Sustained shelling, confirmed fatalities, major offensive
- "UNCERTAIN": Conflicting reports, cannot determine with confidence

STATS RULES:
- casualtyCount: CUMULATIVE fatalities - can only increase, never decrease
- displacedCount: Current number of displaced civilians
- civilianInjuredCount: Separate civilian injuries
- militaryInjuredCount: Separate military injuries
- unchanged: true if you're keeping previous values (this is GOOD if nothing changed)
- changeReason: Explain why you changed or kept the values

PREVIOUS DASHBOARD VALUES (keep these if no new verified evidence):
- Conflict Level: ${prevNeutral?.conflictLevel || "LOW"}
- Casualties: ${prevStats?.casualtyCount ?? 0}
- Displaced: ${prevStats?.displacedCount ?? 0}
- Civilian Injured: ${prevStats?.civilianInjuredCount ?? 0}
- Military Injured: ${prevStats?.militaryInjuredCount ?? 0}

If timeline shows no new casualties/displacement events, KEEP THE SAME NUMBERS.

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
7. FOG OF WAR: If information is genuinely unclear/conflicting, say so. "Insufficient verified information" is a valid answer.

📅 ADAPTIVE SCHEDULING DECISION:
Based on your analysis, decide when the system should run the next intelligence cycle.
This controls monitoring frequency - more active situations need more frequent updates.

GUIDELINES (pick ONE):
• 4 hours: AGGRESSIVE posture detected, active conflict, rapid developments
• 8 hours: ESCALATED posture, elevated tension, multiple new developments  
• 16 hours: DEFENSIVE posture, some activity, routine monitoring
• 24-48 hours: PEACEFUL both sides, minimal changes, quiet period

Return your decision in the "scheduling" section of the JSON.`;

        try {
            // Use generic self-healing helper
            const result = await callGeminiStudioWithSelfHealing<{
                cambodia: any;
                thailand: any;
                neutral: any;
                scheduling?: { nextCycleHours: number; reason: string };
                dashboard?: {
                    conflictLevel?: string;
                    casualtyCount?: number;
                    displacedCount?: number;
                    civilianInjuredCount?: number;
                    militaryInjuredCount?: number;
                    unchanged?: boolean;
                    changeReason?: string;
                };
            }>(prompt, "thinking", 3, "SYNTHESIS");

            if (!result) {
                console.log("❌ [SYNTHESIS] Invalid or missing JSON response from API");
                console.log("ℹ️ [SYNTHESIS] Existing analysis data preserved - no updates will be made this cycle");
                // Return null to indicate failure, but existing analysis tables remain untouched
                // This is intentional: we never overwrite good data with nothing
                return null;
            }

            // Save Cambodia analysis
            if (result.cambodia) {
                const validPostures = ["PEACEFUL", "DEFENSIVE", "ESCALATED", "AGGRESSIVE"];
                const posture = validPostures.includes(result.cambodia.militaryPosture)
                    ? result.cambodia.militaryPosture : "DEFENSIVE";

                const validTerritories = ["OWN_TERRITORY", "DISPUTED_ZONE", "FOREIGN_TERRITORY", "BORDER_ZONE"];
                const territory = validTerritories.includes(result.cambodia.territorialContext)
                    ? result.cambodia.territorialContext : undefined;

                // Clamp intensity to match posture range
                const clampIntensity = (p: string, raw: number) => {
                    if (p === "PEACEFUL") return Math.max(0, Math.min(30, raw || 15));
                    if (p === "DEFENSIVE") return Math.max(31, Math.min(55, raw || 45));
                    if (p === "ESCALATED") return Math.max(56, Math.min(69, raw || 62));
                    return Math.max(70, Math.min(100, raw || 80)); // AGGRESSIVE
                };

                await ctx.runMutation(internal.api.upsertAnalysis, {
                    target: "cambodia",
                    officialNarrative: result.cambodia.officialNarrative || "No narrative available.",
                    officialNarrativeEn: result.cambodia.officialNarrativeEn,
                    officialNarrativeTh: result.cambodia.officialNarrativeTh,
                    officialNarrativeKh: result.cambodia.officialNarrativeKh,
                    narrativeSource: result.cambodia.narrativeSource || "Unknown",
                    militaryIntensity: clampIntensity(posture, result.cambodia.militaryIntensity),
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
                const validPostures = ["PEACEFUL", "DEFENSIVE", "ESCALATED", "AGGRESSIVE"];
                const posture = validPostures.includes(result.thailand.militaryPosture)
                    ? result.thailand.militaryPosture : "DEFENSIVE";

                const validTerritories = ["OWN_TERRITORY", "DISPUTED_ZONE", "FOREIGN_TERRITORY", "BORDER_ZONE"];
                const territory = validTerritories.includes(result.thailand.territorialContext)
                    ? result.thailand.territorialContext : undefined;

                // Clamp intensity to match posture range
                const clampIntensity = (p: string, raw: number) => {
                    if (p === "PEACEFUL") return Math.max(0, Math.min(30, raw || 15));
                    if (p === "DEFENSIVE") return Math.max(31, Math.min(55, raw || 45));
                    if (p === "ESCALATED") return Math.max(56, Math.min(69, raw || 62));
                    return Math.max(70, Math.min(100, raw || 80)); // AGGRESSIVE
                };

                await ctx.runMutation(internal.api.upsertAnalysis, {
                    target: "thailand",
                    officialNarrative: result.thailand.officialNarrative || "No narrative available.",
                    officialNarrativeEn: result.thailand.officialNarrativeEn,
                    officialNarrativeTh: result.thailand.officialNarrativeTh,
                    officialNarrativeKh: result.thailand.officialNarrativeKh,
                    narrativeSource: result.thailand.narrativeSource || "Unknown",
                    militaryIntensity: clampIntensity(posture, result.thailand.militaryIntensity),
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

            // Save Neutral analysis (narrative + key events)
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

            // Save Dashboard Stats (merged from updateDashboard)
            if (result.dashboard) {
                // Log whether values changed or stayed the same
                if (result.dashboard.unchanged) {
                    console.log(`✅ [DASHBOARD] No changes needed: ${result.dashboard.changeReason || "values stable"}`);
                } else {
                    console.log(`📊 [DASHBOARD] Updating values: ${result.dashboard.changeReason || "new evidence found"}`);
                }

                await ctx.runMutation(internal.api.upsertDashboardStats, {
                    conflictLevel: result.dashboard.conflictLevel || result.neutral?.conflictLevel || prevStats?.conflictLevel || "LOW",
                    displacedCount: result.dashboard.displacedCount ?? prevStats?.displacedCount ?? 0,
                    displacedTrend: prevStats?.displacedTrend ?? 0, // Keep existing trend
                    casualtyCount: result.dashboard.casualtyCount ?? prevStats?.casualtyCount ?? 0,
                    civilianInjuredCount: result.dashboard.civilianInjuredCount ?? prevStats?.civilianInjuredCount ?? 0,
                    militaryInjuredCount: result.dashboard.militaryInjuredCount ?? prevStats?.militaryInjuredCount ?? 0,
                });
                console.log(`✅ [DASHBOARD] Stats saved: casualties=${result.dashboard.casualtyCount ?? prevStats?.casualtyCount ?? 0}, displaced=${result.dashboard.displacedCount ?? prevStats?.displacedCount ?? 0}`);
            } else {
                // If no dashboard in response, keep existing values
                console.log(`⚠️ [DASHBOARD] No dashboard section in response - keeping existing values`);
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
            const result = await callGeminiStudioWithSelfHealing<{
                actions: any[];
                crossReferenceNotes?: string;
                summary?: string;
            }>(prompt, "thinking", 3, "MANAGER");

            if (!result) {
                console.log("❌ [MANAGER] Invalid or missing JSON response from API");
                console.log("ℹ️ [MANAGER] No changes will be made this cycle - all articles preserved");
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
// ORCHESTRATOR - CHAINED ACTIONS (Each step gets its own 10-min timer)
// =============================================================================

// Step 1: Curation - Fetches news from all sources
export const runResearchCycle = internalAction({
    args: {},
    handler: async (ctx) => {
        // ═══ DEDUPLICATION: Acquire lock to prevent overlapping runs ═══
        const runId = crypto.randomUUID();
        const lockResult = await ctx.runMutation(internal.api.acquireCycleLock, { runId });

        if (!lockResult.acquired) {
            console.log(`🚫 [CYCLE] Aborting - ${lockResult.reason}`);
            console.log("ℹ️ This happens when manual run overlaps with scheduled run. Only one cycle runs at a time.");
            return;
        }

        // Check if we should skip this cycle (one-time skip, auto-resets)
        const stats = await ctx.runQuery(internal.api.getSystemStatsInternal, {});
        if (stats?.skipNextCycle) {
            console.log("⏭️ SKIPPING THIS CYCLE (skipNextCycle was set)");
            await ctx.runMutation(internal.api.setStatus, { status: "online" });
            await ctx.runMutation(internal.api.clearSkipNextCycle, {});
            await ctx.runMutation(internal.api.releaseCycleLock, { runId }); // Release lock when skipping
            return;
        }

        console.log("═══════════════════════════════════════════════════════════════");
        console.log("🔄 RESEARCH CYCLE STARTED (Chained Actions Mode)");
        console.log("═══════════════════════════════════════════════════════════════");

        await ctx.runMutation(internal.api.setStatus, { status: "syncing" });

        const errors: string[] = [];

        // ── STEP 1: NEWS CURATION ──
        console.log("\n── STEP 1: NEWS CURATION ──");

        try {
            console.log("   > Curating Cambodia...");
            await ctx.runAction(internal.research.curateCambodia, {});
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (e) {
            console.error("❌ [STEP 1] Cambodia Curation Failed:", e);
            errors.push(`Cambodia: ${String(e)}`);
        }

        try {
            console.log("   > Curating Thailand...");
            await ctx.runAction(internal.research.curateThailand, {});
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (e) {
            console.error("❌ [STEP 1] Thailand Curation Failed:", e);
            errors.push(`Thailand: ${String(e)}`);
        }

        try {
            console.log("   > Curating International...");
            await ctx.runAction(internal.research.curateInternational, {});
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (e) {
            console.error("❌ [STEP 1] International Curation Failed:", e);
            errors.push(`International: ${String(e)}`);
        }

        // If all curation failed, abort the chain
        if (errors.length >= 3) {
            console.error("🛑 ALL CURATION STEPS FAILED. Aborting cycle.");
            await ctx.runMutation(internal.api.setStatus, { status: "error", errorLog: "Curation failed completely" });
            await ctx.runMutation(internal.api.releaseCycleLock, { runId });
            return;
        }

        console.log("✅ Step 1 complete. Scheduling Step 2...");

        // Chain to Step 2 (runs immediately with fresh 10-min timer)
        await ctx.scheduler.runAfter(0, internal.research.step2_verification, {
            errors: errors,
            runId: runId
        });
    },
});

// Step 2: Source Verification
export const step2_verification = internalAction({
    args: { errors: v.array(v.string()), runId: v.string() },
    handler: async (ctx, { errors, runId }) => {
        console.log("\n── STEP 2: SOURCE VERIFICATION ──");
        const stepErrors = [...errors];

        try {
            console.log("   > Verifying article sources...");
            const verifyResult = await ctx.runAction(internal.research.verifyAllSources, {});
            console.log(`   ✅ Verified: ${verifyResult.verified}, Updated: ${verifyResult.updated}, Deleted: ${verifyResult.deleted}, Errors: ${verifyResult.errors}`);
        } catch (e) {
            console.error("❌ [STEP 2] Source Verification Failed:", e);
            stepErrors.push(`Verification: ${String(e)}`);
            // Non-fatal - continue with historian
        }

        console.log("✅ Step 2 complete. Scheduling Step 3...");

        // Chain to Step 3 (fresh 10-min timer)
        await ctx.scheduler.runAfter(0, internal.research.step3_historian, {
            errors: stepErrors,
            runId: runId
        });
    },
});

// Step 3: Historian Loop - Now has full 10 mins for processing articles
export const step3_historian = internalAction({
    args: { errors: v.array(v.string()), runId: v.string() },
    handler: async (ctx, { errors, runId }) => {
        console.log("\n── STEP 3: HISTORIAN LOOP ──");
        const stepErrors = [...errors];

        // With chaining, we now have full 10 mins for historian
        const startTime = Date.now();
        const MAX_RUNTIME_MS = 10 * 60 * 1000; // 10 mins (max utilization)
        const getTimeRemaining = () => MAX_RUNTIME_MS - (Date.now() - startTime);

        let historianLoops = 0;
        const MAX_HISTORIAN_LOOPS = 10; // User requested limit

        // ═══ CACHE TIMELINE + NEWS CONTEXT ONCE ═══
        // These rarely change within the loop, so fetch once to save bandwidth
        // Note: If Historian creates new events, they won't appear in cache until next cycle
        // This is acceptable since new events are unlikely to be duplicated by different articles
        const cachedTimeline = await ctx.runQuery(internal.api.getRecentTimeline, { limit: 150 });
        const cachedNewsContext = await ctx.runQuery(internal.api.getRecentNewsContextForHistorian, {});
        console.log(`📦 [CACHE] Timeline: ${cachedTimeline.length} events, News: TH=${cachedNewsContext.TH.length}, KH=${cachedNewsContext.KH.length}, INT=${cachedNewsContext.INT.length}`);

        try {
            while (historianLoops < MAX_HISTORIAN_LOOPS) {
                const timeRemaining = getTimeRemaining();
                if (timeRemaining < 90 * 1000) { // 90s minimum
                    console.log(`   ⏰ Time budget low (${Math.round(timeRemaining / 1000)}s) - moving to synthesis`);
                    break;
                }

                historianLoops++;
                console.log(`\n   📜 Historian iteration ${historianLoops}... (${Math.round(timeRemaining / 1000)}s remaining)`);

                const result = await ctx.runAction(internal.historian.runHistorianCycle, {
                    cachedTimeline,
                    cachedNewsContext,
                });

                if (!result || result.processed === 0) {
                    console.log("   ✅ Historian complete - no more articles to process");
                    break;
                }

                console.log(`   Processed ${result.processed} articles, created ${result.eventsCreated} events`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            if (historianLoops >= MAX_HISTORIAN_LOOPS) {
                console.warn(`   ⚠️ Historian reached max iterations (${MAX_HISTORIAN_LOOPS})`);
            }

            console.log(`   📊 Historian completed after ${historianLoops} iterations`);
        } catch (e) {
            console.error("❌ [STEP 3] Historian Failed:", e);
            stepErrors.push(`Historian: ${String(e)}`);
        }

        console.log("✅ Step 3 complete. Scheduling Step 4...");

        // Chain to Step 4 (fresh 10-min timer for synthesis)
        await ctx.scheduler.runAfter(0, internal.research.step4_synthesis, {
            errors: stepErrors,
            runId: runId
        });
    },
});

// Step 4: Synthesis - Final analysis (gets full 10 mins)
export const step4_synthesis = internalAction({
    args: { errors: v.array(v.string()), runId: v.string() },
    handler: async (ctx, { errors, runId }) => {
        console.log("\n── STEP 4: SYNTHESIS ──");
        const stepErrors = [...errors];
        let schedulingResult: { nextCycleHours: number; reason: string } | null = null;

        try {
            const result = await ctx.runAction(internal.research.synthesizeAll, {});
            console.log("   ✅ Synthesis complete");

            // Extract scheduling decision from AI result
            if (result?.scheduling) {
                const sched = result.scheduling;
                schedulingResult = sched;
                console.log(`   📅 AI scheduling decision: ${sched.nextCycleHours}h - ${sched.reason}`);
            }
        } catch (e) {
            console.error("❌ [STEP 4] Synthesis Failed:", e);
            stepErrors.push(`Synthesis: ${String(e)}`);
        }

        // ═══ ADAPTIVE SCHEDULING with scheduler.runAt ═══
        // Schedule exact next run time (no more heartbeat polling!)
        const nextHours = schedulingResult?.nextCycleHours || 12;
        const clampedHours = Math.max(4, Math.min(48, nextHours)); // Clamp to 4-48 range
        const nextRunAt = Date.now() + (clampedHours * 60 * 60 * 1000);
        const reason = schedulingResult?.reason || "Default scheduling (synthesis did not return decision)";

        console.log(`📅 AI scheduling decision: ${clampedHours}h - ${reason}`);

        // ═══ CANCEL ALL PENDING runResearchCycle JOBS ═══
        // This prevents duplicate stacking from manual runs + scheduled runs
        try {
            const pendingJobIds = await ctx.runQuery(internal.api.getPendingCycleJobs, {});
            if (pendingJobIds.length > 0) {
                console.log(`🗑️ Found ${pendingJobIds.length} pending runResearchCycle jobs - cancelling all...`);
                for (const jobId of pendingJobIds) {
                    try {
                        await ctx.scheduler.cancel(jobId as any);
                        console.log(`   ✓ Cancelled job ${jobId}`);
                    } catch (e) {
                        // Job might have already run or been cancelled
                        console.log(`   ⚠️ Could not cancel ${jobId}: ${e}`);
                    }
                }
            }
        } catch (e) {
            // Non-fatal - continue with scheduling
            console.log(`⚠️ Could not query pending jobs: ${e}`);
        }

        // Schedule the exact next run time
        const scheduledRunId = await ctx.scheduler.runAt(
            nextRunAt,
            internal.research.runResearchCycle,
            {}
        );
        console.log(`📅 [SCHEDULER] Scheduled next run for ${new Date(nextRunAt).toLocaleString()} (${clampedHours}h from now)`);
        console.log(`   Job ID: ${scheduledRunId}`);

        // Store scheduling info for frontend display and tracking
        await ctx.runMutation(internal.api.setNextRunAt, {
            nextRunAt,
            lastCycleInterval: clampedHours,
            schedulingReason: reason,
            scheduledRunId,
        });

        // ═══ CYCLE COMPLETE ═══
        // Increment cycle counter and trigger dashboard (every cycle now, since cycles are 16h+)
        const cycleCount = await ctx.runMutation(internal.api.incrementResearchCycleCount, {});

        if (stepErrors.length === 0) {
            console.log("═══════════════════════════════════════════════════════════════");
            console.log(`✅ RESEARCH CYCLE #${cycleCount} COMPLETE (SUCCESS)`);
            console.log("═══════════════════════════════════════════════════════════════");
            await ctx.runMutation(internal.api.setStatus, { status: "online" });
        } else {
            console.log("═══════════════════════════════════════════════════════════════");
            console.log(`⚠️ RESEARCH CYCLE #${cycleCount} COMPLETE (WITH ERRORS)`);
            console.log("Errors encountered:", stepErrors);
            console.log("═══════════════════════════════════════════════════════════════");
            await ctx.runMutation(internal.api.setStatus, { status: "online", errorLog: stepErrors.join(" | ") });
        }

        // ═══ TRIGGER ISR REVALIDATION ═══
        // Purge Vercel's cache so the next user gets fresh data
        try {
            const VERCEL_URL = process.env.VERCEL_URL || process.env.SITE_URL;
            const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET;

            if (VERCEL_URL) {
                const revalidateUrl = VERCEL_URL.startsWith('http')
                    ? `${VERCEL_URL}/api/revalidate`
                    : `https://${VERCEL_URL}/api/revalidate`;

                console.log(`🔄 [ISR] Triggering cache revalidation at ${revalidateUrl}...`);

                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                };
                if (REVALIDATE_SECRET) {
                    headers['x-revalidate-secret'] = REVALIDATE_SECRET;
                }

                const response = await fetch(revalidateUrl, {
                    method: 'POST',
                    headers,
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log(`✅ [ISR] Cache revalidated successfully:`, result);
                } else {
                    console.warn(`⚠️ [ISR] Revalidation returned ${response.status}: ${await response.text()}`);
                }
            } else {
                console.log("ℹ️ [ISR] No VERCEL_URL/SITE_URL set - skipping cache revalidation");
            }
        } catch (revalidateError) {
            // Non-fatal - don't fail the cycle just because revalidation failed
            console.warn("⚠️ [ISR] Cache revalidation failed (non-fatal):", revalidateError);
        }

        // ═══ RELEASE CYCLE LOCK ═══
        // Always release at the very end of the cycle
        await ctx.runMutation(internal.api.releaseCycleLock, { runId });
    },
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

            // Process 10 articles at a time - smaller batches for better URL verification
            const BATCH_SIZE = 10;

            // Time budget - stop processing before Convex timeout
            const startTime = Date.now();
            const MAX_RUNTIME_MS = 8 * 60 * 1000; // 8 mins (2 min buffer before 10 min limit)
            const getTimeRemaining = () => MAX_RUNTIME_MS - (Date.now() - startTime);

            for (let i = 0; i < allArticles.length; i += BATCH_SIZE) {
                // TIME CHECK - Stop if running low on time
                const timeRemaining = getTimeRemaining();
                if (timeRemaining < 60 * 1000) { // Need at least 1 min for a batch
                    const remaining = allArticles.length - i;
                    console.log(`\n⏰ [SOURCE VERIFY] Time budget exhausted (${Math.round(timeRemaining / 1000)}s left)`);
                    console.log(`   📋 ${remaining} articles will be verified in the next cycle`);
                    break;
                }

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
- VERIFIED: URL loads, content is about Thailand-Cambodia, and reasonably matches our stored info
- NEEDS_UPDATE: URL loads, content IS about Thailand-Cambodia, but our title/summary/date has errors → provide corrections
- URL_DEAD: You received an EXPLICIT HTTP error (404, 403, "page not found"). Not just slow/blocked
- OFF_TOPIC: Content exists but is NOT about Thailand-Cambodia border/relations
- HALLUCINATED: URL shows completely unrelated content (e.g., we said "border clash" but page is about cooking)
- SKIP: Any uncertainty - couldn't load, slow, blocked, unsure, or page changed. ALWAYS prefer this when uncertain!

🧠 SMART VERIFICATION PRINCIPLES:
1. ASSUME URLS ARE VALID unless you have CONCRETE proof they're broken
2. News sites rarely delete recent articles - if you "can't find it", it's probably your access issue, not a dead link
3. Content can be paraphrased differently - minor wording differences ≠ wrong article
4. If the TOPIC matches (Thailand-Cambodia news), the article is probably correct
5. NEVER "fix" a URL by finding a similar article elsewhere - that's replacing, not fixing
6. Your job is to VERIFY, not to be paranoid. Err on the side of keeping articles.

📊 CONFIDENCE DECISION FRAMEWORK:
- 80%+ confident URL is valid and content matches → VERIFIED
- 80%+ confident content needs correction → NEEDS_UPDATE  
- 95%+ confident URL returns 404/403 error → URL_DEAD
- 80%+ confident content is unrelated topic → OFF_TOPIC or HALLUCINATED
- Anything less than these thresholds → SKIP (we'll retry later)

📋 ARTICLES TO VERIFY:
${articlesToVerify}

OUTPUT FORMAT - Wrap your JSON in <json> tags:
<json>
{
  "results": [
    {
      "articleIndex": 1,
      "status": "VERIFIED|NEEDS_UPDATE|URL_DEAD|OFF_TOPIC|HALLUCINATED|SKIP",
      "actualTitle": "What the page headline actually says (original language)",
      "actualSummary": "2-3 sentence summary of what the article ACTUALLY says",
      "actualPublishedAt": "2025-12-14T10:00:00+07:00 (Use LOCAL Thai/Khmer time UTC+7)",
      "isAboutBorder": true,
      "matchScore": 85,
      "reason": "Why you made this determination",
      
      "correctData": {
        // ONLY for NEEDS_UPDATE! Include only fields that need fixing.
        // Example - only date wrong: { "publishedAt": "2025-12-14T16:00:00+07:00" }
        // Example - title wrong: { "title": "...", "titleEn": "...", "titleTh": "...", "titleKh": "..." }
        // Example - URL wrong (Google search link instead of direct article): { "sourceUrl": "https://actual-article-url.com/..." }
      }
    }
  ]
}
</json>

🌐 TRANSLATION RULES (for correctData):
- Translate the MEANING and INTENT, not literal word-for-word
- Understand the context first, then express the same idea naturally in the target language
- Thai: natural, conversational everyday language - how a regular Thai person would explain to a friend
- Khmer: natural, conversational everyday language - how a Cambodian would explain to family
- ALWAYS use English numerals (0-9) - NEVER Thai ๑๒๓ or Khmer ១២៣
- Prioritize clear communication over literal accuracy

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
                    const response = await callGeminiStudioWithFallback(verificationPrompt, FALLBACK_CHAINS.critical, 2, "SOURCE-VERIFY");

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
                        // Convert from 1-indexed (prompt) to 0-indexed (array)
                        const rawIndex = r.articleIndex || 1;
                        const articleIndex = rawIndex - 1;

                        // Validate index - if out of range, try to find by URL matching
                        let article = null;
                        if (articleIndex >= 0 && articleIndex < batch.length) {
                            article = batch[articleIndex];
                        } else {
                            // Fallback: try to find article by URL if AI returned wrong index
                            const matchedByUrl = batch.find(a => r.url && a.sourceUrl === r.url);
                            if (matchedByUrl) {
                                article = matchedByUrl;
                                console.log(`   ⚠️ Index ${rawIndex} out of range, but found by URL match`);
                            } else {
                                console.log(`   ⚠️ Invalid articleIndex ${rawIndex} (batch has ${batch.length}), skipping`);
                                continue;
                            }
                        }

                        processedIndices.add(batch.indexOf(article));
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
                                // DEPRECATED: URL_WRONG is no longer a valid status
                                // If AI still returns it, treat as SKIP (we don't want URL replacements)
                                console.log(`   ⏭️ SKIPPED (URL_WRONG is deprecated - treating as SKIP)`);
                                console.log(`      URL: ${article.sourceUrl}`);
                                console.log(`      Reason: ${r.reason || "Will retry next cycle"}`);
                                // Don't mark as verified - will retry later
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
                                const hasUrl = cd.sourceUrl !== undefined;

                                // Build update object with only changed fields
                                const updateData: any = {
                                    country: article.country,
                                    oldTitle: article.title,
                                    credibility: Math.min(100, (article.credibility || 50) + 10), // Boost cred - now verified!
                                    status: "active",
                                };

                                // Add URL if it needs fixing
                                if (hasUrl) {
                                    updateData.newUrl = cd.sourceUrl;
                                }
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
                                    if (hasUrl) {
                                        console.log(`      URL Fixed: ${article.sourceUrl} → ${cd.sourceUrl}`);
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

                            case "SKIP":
                                // AI couldn't access URL - DON'T mark as verified so we can retry later
                                console.log(`   ⏭️ SKIPPED (AI couldn't access URL - will retry next cycle)`);
                                console.log(`      URL: ${article.sourceUrl}`);
                                console.log(`      Reason: ${r.reason || "Could not access URL"}`);
                                // Don't increment any counter - article stays unverified for next attempt
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
            const response = await callGeminiStudioWithFallback(verificationPrompt, FALLBACK_CHAINS.critical, 2, "VERIFY-SINGLE");

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

// =============================================================================
// MANUAL BACKFILL TOOL
// =============================================================================

export const curateManualGap = internalAction({
    args: {
        date: v.string(), // e.g. "December 7, 2025" or "2025-12-07"
        perspective: v.optional(v.string()) // Optional: "cambodia", "thailand", "international"
    },
    handler: async (ctx, args) => {
        const targetDate = args.date;
        console.log(`🕵️ [MANUAL BACKFILL] Starting curation for date: ${targetDate}`);

        const perspectives = args.perspective
            ? [args.perspective]
            : ["cambodia", "thailand", "international"];

        const results_summary: string[] = [];

        for (const p of perspectives) {
            const country = p as "cambodia" | "thailand" | "international";
            console.log(`\n👉 Backfilling ${country.toUpperCase()} for ${targetDate}...`);

            // Get existing URLs to avoid duplicates
            try {
                // We use try-catch because getExistingTitlesInternal might be internal.api or api.api depending on structure
                // In this file, internal.api is used.
                const existing = await ctx.runQuery(internal.api.getExistingTitlesInternal, { country });
                // We map to verify we have array
                const existingUrls = Array.isArray(existing) ? existing.map((a: any) => a.sourceUrl).join("\n") : "";

                let specificInstructions = "";
                let sourceList = "";

                // 1. CAMBODIA CONFIG
                if (country === "cambodia") {
                    specificInstructions = `
🇰🇭 YOUR PERSPECTIVE: You are searching for news as if you were a CAMBODIAN CITIZEN.
Find news articles that Cambodians would see on their local TV, newspapers, and news websites.

🌐 SEARCH IN MULTIPLE LANGUAGES:
- Search in KHMER: ព្រំដែនថៃ-កម្ពុជា, ជម្លោះព្រំដែន, កងទ័ពថៃ, ទំនាក់ទំនងថៃកម្ពុជា date:${targetDate}
- Search in ENGLISH: Thailand Cambodia border, Cambodia news date:${targetDate}
- PRIORITIZE Khmer-language sources!`;

                    sourceList = `
📺 CAMBODIAN NEWS SOURCES (these are what Cambodians read):
KHMER LANGUAGE (prioritize these!):
• Fresh News ហ្វ្រេសញូស (freshnewsasia.com)
• DAP News ដាប់ញូស (dap-news.com)
• VOD វីអូឌី (vodkhmer.news)
• RFA Khmer វិទ្យុអាស៊ីសេរី (rfa.org/khmer)
• Sabay News សប្បាយញូស (sabay.com.kh)
• Thmey Thmey ថ្មីថ្មី (thmey-thmey.com)
• CNC ស៊ីអិនស៊ី (cnc.com.kh)
• TVK ទូរទស្សន៍កម្ពុជា - National TV
• BTV ប៊ីធីវី (btv.com.kh) - Bayon TV

ENGLISH LANGUAGE:
• Phnom Penh Post (phnompenhpost.com)
• Khmer Times (khmertimeskh.com)
• Cambodia Daily (cambodiadaily.com)
• AKP - Agence Kampuchea Presse (akp.gov.kh)`;
                }

                // 2. THAILAND CONFIG
                else if (country === "thailand") {
                    specificInstructions = `
🇹🇭 YOUR PERSPECTIVE: You are searching for news as if you were a THAI CITIZEN.
Find news articles that Thais would see on their local TV, newspapers, and news websites.

🌐 SEARCH IN MULTIPLE LANGUAGES:
- Search in THAI: ชายแดนไทย-กัมพูชา, ข่าวชายแดน, ทหารไทย, ความสัมพันธ์ไทยกัมพูชา, ปราสาทพระวิหาร date:${targetDate}
- Search in ENGLISH: Thailand Cambodia border, Thai news, Bangkok Post date:${targetDate}
- PRIORITIZE Thai-language sources!`;

                    sourceList = `
📺 THAI NEWS SOURCES (these are what Thais read):
THAI LANGUAGE (prioritize these!):
• ไทยรัฐ Thai Rath (thairath.co.th)
• เดลินิวส์ Daily News (dailynews.co.th)
• มติชน Matichon (matichon.co.th)
• ข่าวสด Khaosod (khaosod.co.th)
• คมชัดลึก Kom Chad Luek (komchadluek.net)
• PPTV HD 36 (pptvhd36.com)
• ช่อง 3 Channel 3 (ch3thailand.com)
• ช่อง 7 Channel 7 (ch7.com)
• Thai PBS ไทยพีบีเอส (thaipbs.or.th)
• กรุงเทพธุรกิจ (bangkokbiznews.com)
• ผู้จัดการ Manager (mgronline.com)

ENGLISH LANGUAGE:
• Bangkok Post (bangkokpost.com)
• The Nation Thailand (nationthailand.com)
• Thai PBS World (thaipbsworld.com)
• Khaosod English (khaosodenglish.com)`;
                }

                // 3. INTERNATIONAL CONFIG
                else if (country === "international") {
                    specificInstructions = `
🌍 YOUR PERSPECTIVE: You are an OUTSIDE OBSERVER - not Thai, not Cambodian.
Find news from international wire services and global news outlets.

🌐 SEARCH IN ENGLISH:
- Search: Thailand Cambodia border conflict, Thailand Cambodia tensions, Southeast Asia border dispute date:${targetDate}
- Focus on WIRE SERVICES and GLOBAL NEWS OUTLETS`;

                    sourceList = `
📺 INTERNATIONAL SOURCES (prioritize these):
WIRE SERVICES (highest credibility):
• Reuters (reuters.com)
• Associated Press / AP News (apnews.com)
• AFP / Agence France-Presse (france24.com)

GLOBAL NEWS OUTLETS:
• BBC (bbc.com)
• Al Jazeera (aljazeera.com)
• CNN International (cnn.com)
• The Guardian (theguardian.com)
• DW Deutsche Welle (dw.com)
• The Diplomat (thediplomat.com)
• Nikkei Asia (asia.nikkei.com)
• South China Morning Post (scmp.com)
• Channel News Asia (channelnewsasia.com)
• Voice of America (voanews.com)
• UN News (news.un.org)`;
                }

                // CONSTRUCT PROMPT with DATE OVERRIDE
                const prompt = `You are a HISTORICAL NEWS RESEARCHER finding articles for a SPECIFIC DATE.
                
Target Date: ${targetDate}

${specificInstructions}

⛔⛔⛔ CRITICAL ANTI-HALLUCINATION RULES ⛔⛔⛔
🚫 DO NOT FABRICATE URLS - Every URL must be real and lead to an article published on ${targetDate}
🚫 DO NOT GUESS URLS
🚫 DO NOT INVENT ARTICLES
🚫 ZERO ARTICLES IS ACCEPTABLE if nothing found for this specific date

🚨 DATE STRICTNESS IS CRITICAL:
- ONLY find news articles published on ${targetDate} or events occurring on ${targetDate}
- Verify the "Published: ..." date on the page matches ${targetDate}
- Do NOT return articles from "Today" (unless today is ${targetDate} in the prompt)
- Do NOT return old articles from years ago

⚠️ WE VERIFY EVERY URL - If your URL returns 404 or doesn't match the date, you have failed.

🔍 YOUR TASK: Search the web for verified news articles about Thailand-Cambodia relations published on ${targetDate} (${country.toUpperCase()} sources).

${sourceList}

⛔ DUPLICATE CHECK - SKIP THESE URLs (we already have them):
${existingUrls || "(database is empty - find new articles!)"}

☝️ DO NOT return any article with a URL from the list above.

FOCUS:
- What happened ON THIS SPECIFIC DAY (${targetDate})?
- Missed events that we need to backfill
- Official statements, clashes, or diplomatic moves on this day

CREDIBILITY SCORING & SUMMARY RULES:
(Same as standard curation - be critical, don't embellish)

OUTPUT FORMAT - Wrap your JSON in <json> tags:
<json>
{
  "newArticles": [
    {
      "title": "Headline",
      "titleEn": "English Headline",
      "titleTh": "Thai Headline",
      "titleKh": "Khmer Headline",
      "publishedAt": "${targetDate}THH:mm:ss+07:00 (Estimate time if unknown, but KEEP DATE CORRECT)",
      "sourceUrl": "https://...",
      "source": "Publication Name",
      "category": "military|political|humanitarian|diplomatic",
      "credibility": 80,
      "summary": "Summary of event on ${targetDate}...",
      "summaryEn": "Summary in English",
      "summaryTh": "Summary in Thai",
      "summaryKh": "Summary in Khmer"
    }
  ],
  "flaggedTitles": []
}
</json>

RULES:
- INCLUDE <json> TAGS
- DATE MUST BE ${targetDate}
- LIST ARTICLES BEFORE JSON`;

                // Call the shared processor
                const result = await processNewsResponse(ctx, prompt, country);
                results_summary.push(`${country}: +${result.newArticles}`);

            } catch (err: any) {
                console.error(`❌ [MANUAL BACKFILL] Error for ${country}: ${err.message}`);
                results_summary.push(`${country}: ERROR`);
            }
        }

        // Reset the auto-cycle timer since we just did a manual run
        await ctx.runMutation(internal.api.setSkipNextCycle, {});

        console.log(`✅ [MANUAL BACKFILL] Completed ${targetDate}: ${results_summary.join(", ")}`);
        return `Backfill Complete for ${targetDate}: ${results_summary.join(", ")}`;
    }
});