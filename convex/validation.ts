"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// =============================================================================
// GHOST API HELPER
// =============================================================================

// Use Koyeb URL for production, fallback to local for testing
import { GHOST_API_URL } from "./config";

async function callGhostAPI(prompt: string, model: "thinking", maxRetries: number = 3): Promise<string> {
    console.log(`🤖 [GHOST API] Calling ${model} model...`);

    const RETRY_DELAY = 5000; // 5 seconds
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

                // On 503/502/504, Retry with thinking
                if ((response.status === 503 || response.status === 502 || response.status === 504)) {
                    if (attempt < maxRetries) {
                        console.warn(`⚠️ [GHOST API] Error ${response.status}, retrying in ${RETRY_DELAY / 1000}s... (${attempt}/${maxRetries})`);
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

            console.log(`✅ [GHOST API] Got response (${data.response?.length || 0} chars) using ${currentModel} model`);
            return data.response || "";

        } catch (error: any) {
            // Handle fetch/network errors
            // Logic removed: Error handling without downgrade.
            if (attempt < maxRetries && (error.message?.includes("503") || error.message?.includes("timeout") || error.message?.includes("ECONNREFUSED"))) {
                console.warn(`⚠️ [GHOST API] Network error, retrying in ${RETRY_DELAY / 1000}s... (${attempt}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                continue;
            }
            throw error;
        }
    }

    throw new Error("Ghost API failed after max retries");
}

async function repairJson(malformed: string, contextPrompt: string): Promise<any | null> {
    console.log("🔧 [REPAIR] Attempting to fix malformed JSON...");
    const repairPrompt = `SYSTEM: You are a JSON REPAIR AGENT.
Your GOAL: Fix the syntax of the provided text to ensure it is VALID JSON.

CONTEXT (The JSON must match this schema/logic):
${contextPrompt}

MALFORMED OUTPUT:
${malformed}

INSTRUCTIONS:
1. Output ONLY the valid JSON object.
2. Do not explain.
3. Fix comma errors, unescaped quotes, or missing brackets.
4. If multiple JSON blocks exist, merge or pick the most complete one.`;

    // Helper to clean and parse
    const cleanAndParse = (input: string) => {
        const clean = input
            .replace(/```json\s*/g, "").replace(/```\s*/g, "")
            .replace(/,\s*([\]\}])/g, '$1')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
            .trim();

        let jsonStr = clean;
        const tagMatch = clean.match(/<json>([\s\S]*?)<\/json>/i);
        if (tagMatch) {
            jsonStr = tagMatch[1];
        } else {
            const jsonMatch = clean.match(/\{[\s\S]*\}/);
            if (jsonMatch) jsonStr = jsonMatch[0];
        }
        return JSON.parse(jsonStr);
    };

    try {
        // Attempt 1: THINKING model
        console.log("   🔧 Using THINKING model for repair...");
        const response = await callGhostAPI(repairPrompt, "thinking", 1);
        return cleanAndParse(response);
    } catch (e) {
        console.warn("   ❌ [REPAIR] Failed to repair JSON:", e);
        return null;
    }
}


// =============================================================================
// MANAGER PLANNING (thinking model) - Decides what task to give the Analyst
// =============================================================================

const MANAGER_PLANNING_PROMPT = `You are the MANAGER in BorderClash, a Thailand-Cambodia border conflict monitoring system.

🔍 YOU CAN SEARCH THE WEB to understand current events before deciding tasks.

YOUR TASK: Decide what the Analyst should work on next.

CONTEXT:
- You validate news article credibility and detect bias
- You will receive current database stats
- Apply EQUAL skepticism to Thai, Cambodian, International, and Government sources
- No source type is automatically 'truth' - assign tasks based on evidence needs
- Assign the most useful task to the Analyst

EFFICIENCY RULES (DO NOT WASTE STEPS):
- GROUP TASKS: Do not check 1 article at a time.
- If "unverifiedCount" is high, your task should be to "Verify batch of unverified articles".
- Maximize the Analyst's time - give them specific but comprehensive instructions.


TASK TYPES:
- "verify": Check article credibility, detect bias from any source
- "cross_reference": Compare claims across sources  
- "translation_check": Verify translations
- "freshness_check": Find outdated articles
- "cleanup": Find duplicates or garbage articles to delete
- "expand": Find missing important articles to insert
- "bias_detection": Deep check for spin/propaganda from any side

ARTICLES TO CHECK:
- "unverified": New articles (use when unverifiedCount is high)
- "conflicts": Articles with conflicting info
- "oldest": Old articles
- "all": General review

OUTPUT FORMAT - Wrap your JSON in <json> tags:
<json>
{
  "taskType": "verify",
  "taskDescription": "Check unverified articles for bias and accuracy",
  "focusAreas": ["bias", "sources"],
  "articlesToCheck": "unverified",
  "priority": "HIGH",
  "reasoning": "40 unverified articles need review"
}
</json>

RULES:
- You MUST include <json> and </json> tags
- Inside the tags, output valid JSON only
- You can think/explain before or after the tags if needed`;

async function runManagerPlanning(stats: any, previousInstruction: string): Promise<{
    taskType: string;
    taskDescription: string;
    focusAreas: string[];
    articlesToCheck: string;
    priority: string;
    reasoning: string;
}> {
    const prompt = `${MANAGER_PLANNING_PROMPT}

CURRENT DATABASE STATUS:
- Total articles: ${stats.totalArticles}
- Unverified: ${stats.unverifiedCount}
- Active (verified): ${stats.activeCount}
- Has conflicts: ${stats.conflictCount}
- Reviewed in last 24h: ${stats.reviewedTodayCount}

PREVIOUS INSTRUCTION (what we did last loop):
${previousInstruction || "(First run - no previous instruction)"}

Based on this, what task should the Analyst work on next? Output JSON only.`;

    const MAX_RETRIES = 2;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        // On retry, prepend error feedback to the ORIGINAL prompt
        const currentPrompt = attempt === 1 ? prompt :
            `⛔ YOUR PREVIOUS RESPONSE WAS NOT VALID JSON. Try again.

Wrap your JSON in <json> tags like this:
<json>
{"taskType": "verify", "taskDescription": "...", "focusAreas": ["..."], "articlesToCheck": "unverified", "priority": "HIGH", "reasoning": "..."}
</json>

--- ORIGINAL REQUEST ---

${prompt}`;

        const response = await callGhostAPI(currentPrompt, "thinking");

        // Extract JSON - first try <json> tags, then fallback to regex
        let jsonString: string | null = null;

        // Method 1: Look for <json>...</json> tags
        const tagMatch = response.match(/<json>([\s\S]*?)<\/json>/i);
        if (tagMatch) {
            jsonString = tagMatch[1].trim();
        } else {
            // Method 2: Fallback - find first { to last }
            const cleanResponse = response
                .replace(/```json\s*/g, "").replace(/```\s*/g, "")
                .replace(/,\s*([\]\}])/g, '$1')
                .trim();
            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonString = jsonMatch[0];
            }
        }

        if (!jsonString) {
            console.log(`⚠️ [MANAGER-PLAN] No JSON found on attempt ${attempt}`);
            if (attempt < MAX_RETRIES) {
                continue;
            }
            // Default fallback
            return {
                taskType: "verify",
                taskDescription: "Review all unverified articles for credibility and accuracy",
                focusAreas: ["propaganda detection", "source verification"],
                articlesToCheck: "unverified",
                priority: "NORMAL",
                reasoning: "Default task - JSON parsing failed",
            };
        }

        try {
            const parsed = JSON.parse(jsonString);
            if (!Array.isArray(parsed.focusAreas)) {
                parsed.focusAreas = [parsed.focusAreas || "credibility"].filter(Boolean);
            }
            return parsed;
        } catch (e: any) {
            console.log(`⚠️ [MANAGER-PLAN] JSON Parse error on attempt ${attempt}: ${e.message}`);

            // ATTEMPT REPAIR
            const repaired = await repairJson(jsonString || response, currentPrompt);
            if (repaired) {
                console.log("✅ [MANAGER-PLAN] JSON Repaired successfully!");
                if (!Array.isArray(repaired.focusAreas)) {
                    repaired.focusAreas = [repaired.focusAreas || "credibility"].filter(Boolean);
                }
                return repaired;
            }

            if (attempt < MAX_RETRIES) {
                continue; // Will use the error-prefixed prompt on next attempt
            }
            return {
                taskType: "verify",
                taskDescription: "Review all unverified articles for credibility and accuracy",
                focusAreas: ["propaganda detection", "source verification"],
                articlesToCheck: "unverified",
                priority: "NORMAL",
                reasoning: "Default task - JSON parsing failed",
            };
        }
    }

    return {
        taskType: "verify",
        taskDescription: "Review all unverified articles for credibility and accuracy",
        focusAreas: ["propaganda detection", "source verification"],
        articlesToCheck: "unverified",
        priority: "NORMAL",
        reasoning: "Default task - max retries exceeded",
    };
}

// =============================================================================
// ANALYST (thinking model) - Executes the task assigned by Manager
// =============================================================================

const ANALYST_SYSTEM_PROMPT = `You are a SKEPTICAL ANALYST executing tasks assigned by your Manager.

🔍 WEB SEARCH - USE IT!
You have access to web search. USE IT to:
- Verify claims in articles by searching for corroboration
- Check if events actually happened
- Find newer updates that might contradict old articles
- Cross-check casualty figures from MULTIPLE independent sources
Don't just analyze what you're given - ACTIVELY VERIFY by searching!

🧠 SYMMETRIC CRITICAL THINKING - DON'T BE FOOLED BY ANYONE:
- ALL parties in a conflict have incentives to exaggerate and spin
- Apply EQUAL skepticism to: Thai sources, Cambodian sources, International sources, Government statements from both sides
- NO source type is automatically 'truth' - judge each claim on EVIDENCE, not origin
- If sources disagree, note the discrepancy without picking a side
- Claims corroborated by MULTIPLE independent sources (regardless of origin) are more reliable
- SEARCH THE WEB to verify before accepting claims

🔴 PROPAGANDA RED FLAGS (suggest lower credibility):
- Emotional language: "heroic defenders", "cowardly attack"
- No evidence cited
- One-sided reporting
- Exaggerated numbers (from ANY source)
- Victory claims without verification
- Unverified "anonymous sources"

🟢 CREDIBILITY GREEN FLAGS (suggest higher credibility):
- Quotes BOTH sides
- Cites specific, verifiable evidence
- Admits uncertainty where appropriate
- Corroborated by multiple independent sources
- Neutral factual tone

SCORING GUIDE (suggest these ranges):
- 80-100: Factual, evidence-based, multiple sides, corroborated
- 60-79: Solid but some gaps or minor bias
- 40-59: Mixed - some facts, some unverified claims
- 20-39: Heavy bias or unverified
- 0-19: Obvious misinformation

FOR EACH ARTICLE, PROVIDE:
1. Your suggested credibility score (0-100)
2. Why (mention if you verified via web search)
3. Suggested status: active, outdated, unverified, false, archived, DUPLICATE (mark for deletion), or MISSING (suggest insertion)
   ⚠️ LOW CREDIBILITY ≠ DELETE! Low-cred propaganda is valuable for understanding what citizens see.
   Only suggest deletion for: broken URLs, actual spam, duplicates.
4. Priority: URGENT/HIGH/NORMAL/LOW
5. Any translation fixes needed (Thai/Khmer)
6. Confidence level: How sure are you about this assessment?

OUTPUT FORMAT: Write your findings naturally. The Manager will make final decisions.
Example:
---
Article 1: "Thai forces advance..."
- Suggested cred: 45 (one-sided reporting, couldn't find corroboration via search)
- Status: active but skeptical
- Priority: NORMAL
- Confidence: MEDIUM (limited sources available)
---`;

async function runAnalyst(batch: any[], crossRef: any[], managerTask: {
    taskType: string;
    taskDescription: string;
    focusAreas: string[];
}): Promise<string> {
    const batchList = batch.map((a: any, i: number) =>
        `${i + 1}. [${a.country.toUpperCase()}] "${a.title}"
   Source: ${a.source} | Category: ${a.category} | Current Credibility: ${a.credibility}
   Status: ${a.status} | Has Conflict: ${a.hasConflict || false}
   URL: ${a.sourceUrl}
   Summary: ${a.summary || a.summaryEn || "(no summary)"}`
    ).join("\n\n");

    const crossRefList = crossRef.map((a: any) =>
        `- [${a.country.toUpperCase()}] "${a.title}" (${a.source}, cred: ${a.credibility})
   Summary: ${a.summary || "(no summary)"}`
    ).join("\n");

    const prompt = `${ANALYST_SYSTEM_PROMPT}

═══════════════════════════════════════════════════════════════
📋 YOUR TASK FROM MANAGER:
Task Type: ${managerTask.taskType}
Instructions: ${managerTask.taskDescription}
Focus Areas: ${(managerTask.focusAreas || []).join(", ") || "general review"}
═══════════════════════════════════════════════════════════════

ARTICLES TO ANALYZE (${batch.length}):
${batchList}

CROSS-REFERENCE ARTICLES (use these to verify claims):
${crossRefList || "(none available)"}

Execute the Manager's task and report your findings.`;

    const response = await callGhostAPI(prompt, "thinking");
    return response;
}

// =============================================================================
// MANAGER FINALIZING (thinking model) - Reviews findings & decides next action
// =============================================================================

const MANAGER_FINALIZING_PROMPT = `You are the MANAGER in BorderClash, a Thailand-Cambodia border conflict monitoring system.

🔍 YOU CAN SEARCH THE WEB to verify claims before making final decisions.
🧠 THINK CRITICALLY - Apply EQUAL skepticism to ALL sources (Thai, Cambodian, International, Government).

YOUR TASK: Review the Analyst's findings and make final decisions.

CONTEXT:
- The Analyst analyzed articles and gave suggestions
- YOU make the final call (agree, modify, or override)
- Use web search to verify if you're unsure about anything
- ALL sides may have biases - no source is automatically truth
- You also assign the NEXT task for the Analyst

SYMMETRIC SKEPTICISM:
- Apply the same standard to Thai, Cambodian, and International sources
- Government statements from BOTH sides should be verified, not dismissed outright
- Prioritize claims corroborated by MULTIPLE independent sources
- If uncertain, it's OK to mark as "unverified" rather than guessing

ACTIONS:
- "verify": Update credibility/status
- "delete": REMOVE invalid/duplicate articles
- "insert": ADD important missing articles found during research

FIELDS TO OUTPUT:
- completionPercent: 0-100, how done is validation
- status: "CONTINUE" or "DONE"
- finalActions: array of article updates (can be empty [])
- nextTask: what Analyst does next (null if status is "DONE")
- reasoning: your thoughts
- confidence: How confident are you in these decisions?

OUTPUT FORMAT - Wrap your JSON in <json> tags:
<json>
{
  "completionPercent": 45,
  "status": "CONTINUE",
  "confidence": "HIGH|MEDIUM|LOW",
  "finalActions": [
    {
      "title": "Exact article title here",
      "action": "verify",
      "newCredibility": 65,
      "newStatus": "active",
      "revalidationPriority": "HIGH",
      "reason": "One-sided reporting, lowered credibility"
    }
  ],
  "nextTask": {
    "taskType": "cross_reference",
    "taskDescription": "Compare claims between sources",
    "focusAreas": ["casualties", "timeline"],
    "articlesToCheck": "conflicts"
  },
  "reasoning": "Verified 8 articles. Found bias in some. Next: cross-reference."
}
</json>

RULES:
- You MUST include <json> and </json> tags
- Inside the tags, output valid JSON only
- You can think/explain before or after the tags if needed
- Use English numerals (0-9), not Thai/Khmer`;

async function runManagerFinalizing(stats: any, analystFindings: string, articleContext: string, originalTask: {
    taskType: string;
    taskDescription: string;
}): Promise<{
    completionPercent: number;
    status: "CONTINUE" | "DONE";
    finalActions: Array<{
        title: string;
        action: string;
        newCredibility?: number;
        newStatus?: string;
        revalidationPriority?: string;
        fixedTitleTh?: string;
        fixedTitleKh?: string;
        // Insert fields
        insertData?: {
            title: string;
            country: string;
            url: string;
            source: string;
            summary: string;
        };
        reason: string;
    }>;
    nextTask: {
        taskType: string;
        taskDescription: string;
        focusAreas: string[];
        articlesToCheck: string;
    } | null;
    reasoning: string;
}> {
    const prompt = `${MANAGER_FINALIZING_PROMPT}

CURRENT DATABASE STATUS:
- Total articles: ${stats.totalArticles}
- Unverified: ${stats.unverifiedCount}
- Active (verified): ${stats.activeCount}
- Has conflicts: ${stats.conflictCount}
- Reviewed in last 24h: ${stats.reviewedTodayCount}

THE TASK I ASSIGNED:
Task Type: ${originalTask.taskType}
Instructions: ${originalTask.taskDescription}

ANALYST'S FINDINGS (review and make YOUR decisions):
${analystFindings}

ARTICLE CONTEXT:
${articleContext}

Review the findings and output your decision wrapped in <json> tags.`;

    const MAX_RETRIES = 2;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        // On retry, prepend error feedback to the ORIGINAL prompt
        const currentPrompt = attempt === 1 ? prompt :
            `⛔ YOUR PREVIOUS RESPONSE WAS NOT VALID JSON. Try again.

Wrap your JSON in <json> tags like this:
<json>
{"completionPercent": 50, "status": "CONTINUE", "finalActions": [...], "nextTask": {...}, "reasoning": "..."}
</json>

--- ORIGINAL REQUEST ---

${prompt}`;

        const response = await callGhostAPI(currentPrompt, "thinking");

        // Extract JSON - first try <json> tags, then fallback to regex
        let jsonString: string | null = null;

        // Method 1: Look for <json>...</json> tags
        const tagMatch = response.match(/<json>([\s\S]*?)<\/json>/i);
        if (tagMatch) {
            jsonString = tagMatch[1].trim();
        } else {
            // Method 2: Fallback - find first { to last }
            const cleanResponse = response
                .replace(/```json\s*/g, "").replace(/```\s*/g, "")
                .replace(/,\s*([\]\}])/g, '$1')
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars
                .trim();
            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonString = jsonMatch[0];
            }
        }

        // Normalize priority values
        if (jsonString) {
            jsonString = jsonString.replace(/"revalidationPriority"\s*:\s*"(urgent|high|normal|low)"/gi,
                (match, priority) => `"revalidationPriority": "${priority.toUpperCase()}"`);
        }

        if (!jsonString) {
            console.log(`⚠️ [MANAGER-FINAL] No JSON found on attempt ${attempt}`);
            if (attempt < MAX_RETRIES) {
                continue;
            }
            return {
                completionPercent: 0,
                status: "CONTINUE",
                finalActions: [],
                nextTask: null, // Force re-planning on error
                reasoning: "JSON parsing failed - detailed actions lost",
            };
        }

        try {
            const parsed = JSON.parse(jsonString);
            // Ensure nextTask.focusAreas is always an array if nextTask exists
            if (parsed.nextTask && !Array.isArray(parsed.nextTask.focusAreas)) {
                parsed.nextTask.focusAreas = [parsed.nextTask.focusAreas || "credibility"].filter(Boolean);
            }
            // Ensure finalActions is always an array
            if (!Array.isArray(parsed.finalActions)) {
                parsed.finalActions = [];
            }
            return parsed;
        } catch (e: any) {
            console.log(`⚠️ [MANAGER-FINAL] JSON Parse error on attempt ${attempt}: ${e.message}`);

            // ATTEMPT REPAIR
            const repaired = await repairJson(jsonString || response, currentPrompt);
            if (repaired) {
                console.log("✅ [MANAGER-FINAL] JSON Repaired successfully!");
                // Ensure array types for repaired data
                if (repaired.nextTask && !Array.isArray(repaired.nextTask.focusAreas)) {
                    repaired.nextTask.focusAreas = [repaired.nextTask.focusAreas || "credibility"].filter(Boolean);
                }
                if (!Array.isArray(repaired.finalActions)) {
                    repaired.finalActions = [];
                }
                return repaired;
            }

            if (attempt < MAX_RETRIES) {
                continue; // Will use the error-prefixed prompt on next attempt
            }
            return {
                completionPercent: 0,
                status: "CONTINUE",
                finalActions: [],
                nextTask: null, // Force re-planning on error
                reasoning: "JSON parsing failed - detailed actions lost",
            };
        }
    }

    return {
        completionPercent: 0,
        status: "CONTINUE",
        finalActions: [],
        nextTask: null, // Force re-planning on error
        reasoning: "Max retries exceeded - detailed actions lost",
    };
}

// =============================================================================
// MAIN VALIDATION LOOP
// =============================================================================

const MAX_ITERATIONS = 50;
const BATCH_SIZE = 10;  // Restored to 10 (User requested higher limit instead of small batch)
const STALL_THRESHOLD = 4; // Stop if completion % unchanged for this many loops
const TIME_LIMIT = 60 * 60 * 1000; // 60 minutes (effectively disabled limit)

export const runValidationLoop = internalAction({
    args: {},
    handler: async (ctx) => {
        console.log("═══════════════════════════════════════════════════════════════");
        console.log("🔍 VALIDATION LOOP STARTED");
        console.log("═══════════════════════════════════════════════════════════════");

        const START_TIME = Date.now();
        const RUN_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);
        console.log(`🔒 Starting Validation Run: ${RUN_ID}`);

        // ============================================
        // STALE STATE CLEANUP - Reset crashed runs
        // If a previous run crashed and left isRunning=true, detect and reset it
        // ============================================
        const STALE_THRESHOLD = 10 * 60 * 1000; // 10 minutes
        const existingState = await ctx.runQuery(internal.api.getValidationState, {});
        if (existingState?.isRunning && existingState.lastUpdatedAt) {
            const staleTime = Date.now() - existingState.lastUpdatedAt;
            if (staleTime > STALE_THRESHOLD) {
                console.log(`⚠️ Found stale run (${Math.round(staleTime / 60000)}min old). Previous run likely crashed. Resetting...`);
                await ctx.runMutation(internal.api.updateValidationState, {
                    isRunning: false,
                    activeRunId: undefined,
                    currentInstruction: "Previous run crashed - reset by stale detection",
                });
            }
        }

        // Initialize state & Claim Lock
        await ctx.runMutation(internal.api.updateValidationState, {
            isRunning: true,
            activeRunId: RUN_ID,
            currentLoop: 0,
            currentInstruction: "Starting validation...",
        });

        let loopCount = 0;
        let completionPercent = 0;

        // Track the current task (Manager decides what Analyst should do)
        let currentTask: {
            taskType: string;
            taskDescription: string;
            focusAreas: string[];
            articlesToCheck: string;
        } | null = null;

        // Stall detection
        let lastCompletionPercent = -1;
        let stallCount = 0;

        try {
            while (loopCount < MAX_ITERATIONS) {
                // TIME LIMIT CHECK
                if (Date.now() - START_TIME > TIME_LIMIT) {
                    console.log(`⚠️ Time limit reached (${TIME_LIMIT / 1000}s). Stopping validation loop gracefully.`);
                    break;
                }

                // HIGHLANDER LOCK CHECK (There can be only one)
                // We check if another process has overwritten our runId
                const currentState = await ctx.runQuery(internal.api.getValidationState, {});
                if (currentState?.activeRunId && currentState.activeRunId !== RUN_ID) {
                    console.log(`🛑 Another validation loop (ID: ${currentState.activeRunId}) has started. Stopping this one (ID: ${RUN_ID}).`);
                    break;
                }

                // Note: isPaused check removed - manual runs always execute
                // The automatic cron is disabled, so pause only affects that

                loopCount++;
                console.log(`\n══════════════════════════════════════════════════════════════`);
                console.log(`                     LOOP ${loopCount}/${MAX_ITERATIONS}`);
                console.log(`══════════════════════════════════════════════════════════════`);

                // Get current stats
                const stats = await ctx.runQuery(internal.api.getValidationStats, {});

                // ============================================
                // STEP 1: MANAGER PLANNING (thinking model)
                // Decides what task to give the Analyst
                // ============================================
                // ============================================
                // STEP 1: MANAGER PLANNING (thinking model)
                // Decides what task to give the Analyst
                // ============================================
                let managerTask;

                if (currentTask) {
                    console.log("\n🧠 [STEP 1] MANAGER PLANNING - SKIPPED (Using Next Task from previous loop)");
                    console.log(`   ⏭️ Continuing with: "${currentTask.taskDescription}"`);
                    managerTask = {
                        ...currentTask,
                        priority: "HIGH", // Default since Manager chose it specifically
                        reasoning: "Continuation of previous loop's assigned task"
                    };
                } else {
                    console.log("\n🧠 [STEP 1] MANAGER PLANNING - Deciding what to delegate...");

                    const previousInstruction = "(First run)";
                    managerTask = await runManagerPlanning(stats, previousInstruction);
                }

                console.log(`   📋 Task Type: ${managerTask.taskType}`);
                console.log(`   📋 Focus: ${managerTask.focusAreas.join(", ")}`);
                console.log(`   📋 Check: ${managerTask.articlesToCheck}`);
                console.log(`   💭 Reasoning: ${managerTask.reasoning}`);

                // Get batch of articles based on Manager's decision
                const batch = await ctx.runQuery(internal.api.getUnreviewedBatch, {
                    batchSize: BATCH_SIZE,
                    priority: managerTask.articlesToCheck,
                });

                if (batch.length === 0) {
                    console.log("⚠️ No more articles to review");
                    break;
                }

                // Get cross-reference articles from ALL countries for full context
                const crossRef = await ctx.runQuery(internal.api.getCrossRefArticles, {
                    limit: 15,
                });

                // ============================================
                // STEP 2: ANALYST EXECUTING (thinking model)
                // Does the task Manager assigned
                // ============================================
                console.log(`\n📝 [STEP 2] ANALYST EXECUTING - Working on ${batch.length} articles...`);
                console.log(`   Task: "${managerTask.taskDescription}"`);

                const analystFindings = await runAnalyst(batch, crossRef, managerTask);
                console.log(`   ✅ Analyst returned ${analystFindings.length} chars of findings`);

                // Edge case: empty findings
                if (!analystFindings || analystFindings.length < 50) {
                    console.warn("   ⚠️ Analyst returned very short/empty findings, proceeding with caution...");
                }

                // Build article context for Manager's final review (include URL and credibility for verification)
                const articleContext = batch.map((a: any) =>
                    `- [${a.country.toUpperCase()}] "${a.title}"
   Source: ${a.source} (cred:${a.credibility || 50}) | URL: ${a.sourceUrl}
   Summary: ${a.summary || a.summaryEn || "(none)"}`
                ).join("\n");

                // ============================================
                // STEP 3: MANAGER FINALIZING (thinking model)
                // Reviews findings, makes decisions, decides next task
                // ============================================
                console.log("\n🧠 [STEP 3] MANAGER FINALIZING - Reviewing findings & deciding...");

                const managerResult = await runManagerFinalizing(stats, analystFindings, articleContext, {
                    taskType: managerTask.taskType,
                    taskDescription: managerTask.taskDescription,
                });

                completionPercent = managerResult.completionPercent;

                // Store next task for the next loop
                currentTask = managerResult.nextTask;

                await ctx.runMutation(internal.api.updateValidationState, {
                    currentLoop: loopCount,
                    lastManagerRun: Date.now(),
                    completionPercent,
                    currentInstruction: currentTask?.taskDescription || "Validation complete",
                });

                console.log(`\n📊 LOOP ${loopCount} RESULTS:`);
                console.log(`   Completion: ${completionPercent}%`);
                console.log(`   Final actions: ${managerResult.finalActions?.length || 0}`);
                console.log(`   Next task: ${currentTask?.taskType || "DONE"}`);
                console.log(`   Reasoning: ${managerResult.reasoning}`);

                // ============================================
                // STEP 4: Apply Manager's final decisions to DB
                // ============================================
                for (const action of managerResult.finalActions || []) {
                    const article = batch.find((a: any) => a.title === action.title);
                    if (!article) continue;

                    // ============================================
                    // HANDLE DIFFERENT ACTION TYPES
                    // ============================================

                    // 1. DELETE ACTION
                    if (action.action === "delete") {
                        await ctx.runMutation(internal.api.deleteArticle, {
                            country: article.country,
                            title: action.title,
                            reason: action.reason
                        });
                        console.log(`   🗑️ DELETED: "${action.title}" | ${action.reason}`);
                        continue; // Skip update
                    }

                    // 2. INSERT ACTION
                    if (action.action === "insert" && action.insertData) {
                        // We need to map the string country to the union type
                        const validCountries = ["thailand", "cambodia", "international"];
                        const country = validCountries.includes(action.insertData.country.toLowerCase())
                            ? action.insertData.country.toLowerCase() as "thailand" | "cambodia" | "international"
                            : "international";

                        await ctx.runMutation(internal.api.insertArticle, {
                            perspective: country,
                            title: action.insertData.title,
                            sourceUrl: action.insertData.url,
                            source: action.insertData.source,
                            publishedAt: Date.now(), // Estimate
                            category: "military", // Default
                            credibility: 50, // Start neutral
                            summary: action.insertData.summary
                        });
                        console.log(`   ➕ INSERTED: "${action.insertData.title}" | ${action.reason}`);
                        continue;
                    }

                    // 3. UPDATE ACTION (Verify/Flag)
                    // Calculate next review time based on priority
                    let nextReviewIn = 12 * 60 * 60 * 1000; // Default NORMAL (12h)
                    const p = action.revalidationPriority || "NORMAL";

                    if (p === "URGENT") nextReviewIn = 1 * 60 * 60 * 1000;
                    if (p === "HIGH") nextReviewIn = 4 * 60 * 60 * 1000;
                    if (p === "LOW") nextReviewIn = 24 * 60 * 60 * 1000;

                    // Sanitize status - AI sometimes invents new values
                    const VALID_STATUSES = ["active", "outdated", "unverified", "false", "archived"] as const;
                    let sanitizedStatus: typeof VALID_STATUSES[number] | undefined = undefined;
                    if (action.newStatus) {
                        const rawStatus = action.newStatus.toLowerCase().trim();
                        if (VALID_STATUSES.includes(rawStatus as any)) {
                            sanitizedStatus = rawStatus as typeof VALID_STATUSES[number];
                        } else if (rawStatus.includes("active") || rawStatus.includes("verified")) {
                            sanitizedStatus = "active";
                            console.log(`   ⚠️ Normalized status "${action.newStatus}" → "active"`);
                        } else if (rawStatus.includes("false") || rawStatus.includes("fake") || rawStatus.includes("misinformation")) {
                            sanitizedStatus = "false";
                            console.log(`   ⚠️ Normalized status "${action.newStatus}" → "false"`);
                        } else if (rawStatus.includes("outdated") || rawStatus.includes("old")) {
                            sanitizedStatus = "outdated";
                            console.log(`   ⚠️ Normalized status "${action.newStatus}" → "outdated"`);
                        } else if (rawStatus.includes("archive")) {
                            sanitizedStatus = "archived";
                            console.log(`   ⚠️ Normalized status "${action.newStatus}" → "archived"`);
                        } else {
                            // Default to unverified if we can't understand
                            sanitizedStatus = "unverified";
                            console.log(`   ⚠️ Unknown status "${action.newStatus}" → defaulting to "unverified"`);
                        }
                    }

                    await ctx.runMutation(internal.api.updateArticleValidation, {
                        country: article.country,
                        title: action.title,
                        credibility: action.newCredibility,
                        status: sanitizedStatus,
                        hasConflict: action.action === "flag_conflict",
                        nextReviewAt: Date.now() + nextReviewIn,
                        // Apply translation fixes from Manager
                        titleTh: action.fixedTitleTh,
                        titleKh: action.fixedTitleKh,
                    });
                    console.log(`   ✅ Applied: "${action.title}" → cred:${action.newCredibility} | ${action.reason}`);
                }

                // Stall detection - stop if stuck at same completion for too long
                if (completionPercent === lastCompletionPercent) {
                    stallCount++;
                    if (stallCount >= STALL_THRESHOLD) {
                        console.log(`⚠️ Stalled at ${completionPercent}% for ${stallCount} loops. Stopping.`);
                        break;
                    }
                } else {
                    stallCount = 0; // Reset if progress made
                }
                lastCompletionPercent = completionPercent;

                // Check if Manager says we're done
                if (managerResult.status === "DONE" || !currentTask) {
                    console.log("\n✅ Manager says: DONE! Database is healthy.");
                    break;
                }

                // Delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Complete
            console.log("\n═══════════════════════════════════════════════════════════════");
            console.log("✅ VALIDATION COMPLETE");
            console.log("═══════════════════════════════════════════════════════════════");

            await ctx.runMutation(internal.api.updateValidationState, {
                isRunning: false,
                completionPercent: 100,
            });

            // Note: Synthesis is run separately via research:synthesizeAll

        } catch (error) {
            console.error("❌ Validation error:", error);
            await ctx.runMutation(internal.api.updateValidationState, {
                isRunning: false,
                currentInstruction: `Error: ${error}`,
            });
        }
    },
});
