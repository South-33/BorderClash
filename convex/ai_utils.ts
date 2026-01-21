"use node";

import { GEMINI_STUDIO_API_URL, MODELS, FALLBACK_CHAINS } from "./config";

/**
 * Call the gemini-studio-api (OpenAI compatible)
 */
export async function callGeminiStudio(prompt: string, model: string, maxRetries: number = 4): Promise<string> {
    // 🗓️ INJECT CURRENT DATE (Bangkok Time)
    const bangkokDate = new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok", dateStyle: "full", timeStyle: "short" });
    const datedPrompt = `[CURRENT DATE: ${bangkokDate}]\n\n${prompt}`;

    console.log(`🤖 [GEMINI STUDIO] Calling ${model}...`);
    const RETRY_DELAY = 8000; // 8 seconds - enough time for Cloudflare tunnel to reconnect

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const startTime = Date.now();

        // 3-minute timeout per request (Gemini can be slow on complex prompts)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000);

        try {
            const response = await fetch(`${GEMINI_STUDIO_API_URL}/v1/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer anything",
                    // Browser-like headers to bypass Cloudflare bot protection
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "application/json, text/plain, */*",
                    "Accept-Language": "en-US,en;q=0.9",
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: "user", content: datedPrompt }]
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const duration = Date.now() - startTime;

            if (!response.ok) {
                const errorText = await response.text();
                console.warn(`⚠️ [GEMINI STUDIO] Error ${response.status} after ${duration}ms: ${errorText.substring(0, 100)}`);
                throw new Error(`API error (${response.status}): ${errorText.substring(0, 100)}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;

            if (!content) {
                throw new Error("API returned empty response content");
            }

            console.log(`✅ [GEMINI STUDIO] Got response (${content.length} chars) in ${duration}ms`);
            return content;

        } catch (error) {
            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;
            console.warn(`⚠️ [GEMINI STUDIO] Attempt ${attempt}/${maxRetries} failed after ${duration}ms: ${error}`);

            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            } else {
                throw error;
            }
        }
    }
    throw new Error("API failed after max retries");
}

/**
 * Check if an error is a rate limit error (429 or rate/quota keywords)
 */
function isRateLimitError(error: any): boolean {
    const errorStr = String(error?.message || error).toLowerCase();
    return errorStr.includes("429") ||
        errorStr.includes("rate") ||
        errorStr.includes("quota") ||
        errorStr.includes("too many");
}

/**
 * Call Gemini API with smart model fallback for rate limit handling.
 * Tries each model in the fallback chain until one succeeds.
 * 
 * @param prompt - The prompt to send
 * @param fallbackChain - Array of model names to try in order (default: critical chain)
 * @param maxRetriesPerModel - Max retries per model before moving to next (default: 2)
 * @param debugLabel - Label for logging
 */
export async function callGeminiStudioWithFallback(
    prompt: string,
    fallbackChain: readonly string[] = FALLBACK_CHAINS.critical,
    maxRetriesPerModel: number = 2,
    debugLabel: string = "AI"
): Promise<string> {
    const RETRY_DELAY = 5000; // 5 seconds between retries

    for (let modelIdx = 0; modelIdx < fallbackChain.length; modelIdx++) {
        const model = fallbackChain[modelIdx];
        const isLastModel = modelIdx === fallbackChain.length - 1;

        for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
            try {
                console.log(`🤖 [${debugLabel}] Model '${model}' attempt ${attempt}/${maxRetriesPerModel}...`);
                const result = await callGeminiStudio(prompt, model, 1);

                if (modelIdx > 0) {
                    console.log(`✅ [${debugLabel}] Got response from fallback model '${model}'`);
                }
                return result;

            } catch (error: any) {
                const errorMsg = error?.message || String(error);

                // Check if this is a rate limit error
                if (isRateLimitError(error)) {
                    console.warn(`⚠️ [${debugLabel}] Model '${model}' rate limited: ${errorMsg.substring(0, 80)}`);

                    if (!isLastModel) {
                        console.log(`🔄 [${debugLabel}] Falling back to next model '${fallbackChain[modelIdx + 1]}'...`);
                        break; // Skip remaining retries, move to next model
                    } else {
                        console.error(`❌ [${debugLabel}] All models exhausted (last was '${model}')`);
                        throw new Error(`All models rate limited. Last error: ${errorMsg}`);
                    }
                }

                // Non-rate-limit error (network, timeout, etc.) - retry same model
                console.warn(`⚠️ [${debugLabel}] Model '${model}' error (attempt ${attempt}): ${errorMsg.substring(0, 80)}`);

                if (attempt < maxRetriesPerModel) {
                    await new Promise(r => setTimeout(r, RETRY_DELAY));
                } else if (!isLastModel) {
                    console.log(`🔄 [${debugLabel}] Max retries on '${model}', trying '${fallbackChain[modelIdx + 1]}'...`);
                } else {
                    throw error; // Last model, last attempt - propagate error
                }
            }
        }
    }

    throw new Error("All models in fallback chain failed");
}

/**
 * GENERIC SELF-HEALING HELPER
 * Handles retry logic and JSON repair
 * Extracts JSON from <json> tags first, then falls back to regex
 * Uses model fallback for thinking model (critical chain: thinking → pro → fast)
 */
export async function callGeminiStudioWithSelfHealing<T>(
    prompt: string,
    modelType: keyof typeof MODELS = "thinking",
    maxRetries: number = 3,
    debugLabel: string = "AI"
): Promise<T | null> {
    let currentPrompt = prompt;

    // Use fallback chain for thinking model (critical tasks)
    const useFallback = modelType === "thinking";
    const fallbackChain = useFallback ? FALLBACK_CHAINS.critical : [MODELS[modelType]];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let rawResponse = "";
        try {
            console.log(`🤖 [${debugLabel}] Attempt ${attempt}/${maxRetries}...`);

            // 1. CALL API - use fallback for thinking model
            try {
                if (useFallback) {
                    rawResponse = await callGeminiStudioWithFallback(currentPrompt, fallbackChain, 2, debugLabel);
                } else {
                    rawResponse = await callGeminiStudio(currentPrompt, MODELS[modelType], 1);
                }
            } catch (networkError: any) {
                console.log(`⚠️ [${debugLabel}] API error: ${networkError.message}`);
                throw networkError;
            }

            // 2. EXTRACT JSON
            let jsonStr: string | null = null;
            const tagMatch = rawResponse.match(/<json>([\s\S]*?)<\/json>/i);
            if (tagMatch) {
                jsonStr = tagMatch[1].trim();
            } else {
                const cleanedResponse = rawResponse
                    .replace(/```json\s*/g, "").replace(/```\s*/g, "")
                    .trim();
                const firstOpen = cleanedResponse.indexOf('{');
                const lastClose = cleanedResponse.lastIndexOf('}');
                if (firstOpen !== -1 && lastClose !== -1) {
                    jsonStr = cleanedResponse.substring(firstOpen, lastClose + 1);
                }
            }

            if (!jsonStr) throw new Error("No JSON object found");

            // 3. PARSE
            try {
                return JSON.parse(jsonStr.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')) as T;
            } catch (parseError: any) {
                if (attempt < maxRetries) {
                    currentPrompt = `Your previous response had invalid JSON. Please fix it and wrap in <json> tags.\n\nERROR: ${parseError.message}\n\nRESPONSE:\n${rawResponse.substring(0, 1000)}`;
                    continue;
                } else throw parseError;
            }
        } catch (e: any) {
            console.error(`❌ [${debugLabel}] Failed: ${e.message}`);
            // Add delay for network errors to give Cloudflare tunnel time to reconnect
            if (attempt < maxRetries) {
                console.log(`⏳ [${debugLabel}] Waiting 8s before retry...`);
                await new Promise(resolve => setTimeout(resolve, 8000));
            }
        }
    }
    return null;
}

// =============================================================================
// SHARED HELPER: Format timeline events consistently for all AI prompts
// Used by: research.ts (synthesizeAll), historian.ts (runHistorian, runPlanner)
// =============================================================================

/**
 * Format a timeline event for inclusion in AI prompts.
 * Returns a compact, readable string with all relevant event details.
 */
export function formatTimelineEvent(e: any, idx?: number): string {
    const time = e.timeOfDay ? ` ${e.timeOfDay}` : "";
    // Sort by credibility (highest first) before taking top 2
    const sortedSources = [...(e.sources || [])].sort((a: any, b: any) => (b.credibility || 0) - (a.credibility || 0));
    const sources = sortedSources.slice(0, 2).map((s: any) => `${s.name}(${s.credibility}): ${s.url}`).join(" | ") || "(none)";
    const trans = (e.titleTh && e.titleKh) ? "✓" : "⚠️needs-trans";
    const prefix = idx !== undefined ? `${idx + 1}. ` : "";
    return `${prefix}[${e.date}${time}] "${e.title}" (${e.status}, ${e.category}, imp:${e.importance}) [${trans}]
   ${e.description}
   Sources: ${sources}`;
}
