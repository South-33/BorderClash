"use node";

import { randomUUID } from "node:crypto";

import { GEMINI_CLIENT_NAME, GEMINI_PROJECT_NAME, GEMINI_STUDIO_API_URL, MODELS, FALLBACK_CHAINS } from "./config";

type GeminiThinkingLevel = "standard" | "extended";

type GeminiRequestInit = {
    headers: Record<string, string>;
    body: {
        model: string;
        thinking_level?: GeminiThinkingLevel;
        messages: Array<{ role: "user"; content: string }>;
        project: string;
        client: string;
        request_id: string;
        metadata: {
            project: string;
            client: string;
        };
    };
    requestId: string;
};

const THINKING_LEVEL_SUFFIXES: Array<[string, GeminiThinkingLevel]> = [
    ["high", "extended"],
    ["extended", "extended"],
    ["standard", "standard"],
    ["medium", "standard"],
    ["low", "standard"],
    ["minimal", "standard"],
];

export function resolveGeminiModel(model: string): { model: string; thinkingLevel?: GeminiThinkingLevel } {
    for (const [suffix, thinkingLevel] of THINKING_LEVEL_SUFFIXES) {
        const marker = `-${suffix}`;
        if (model.endsWith(marker)) {
            return {
                model: model.slice(0, -marker.length),
                thinkingLevel,
            };
        }
    }

    return { model };
}

export const TRANSLATION_STYLE_GUIDE = `LANGUAGE & TRANSLATION VOICE:
- Write like a careful local translator, not a literal dictionary. Understand the event first, then retell it in normal Thai/Khmer.
- CRITICAL SCRIPT RULE:
  - All fields ending in "Th" (e.g., titleTh, descriptionTh, officialNarrativeTh, generalSummaryTh, keyEventsTh, postureLabelTh, postureRationaleTh) MUST be written in Thai language using the THAI SCRIPT (ไทย) ONLY. Do NOT write in Khmer script or English in these fields.
  - All fields ending in "Kh" (e.g., titleKh, descriptionKh, officialNarrativeKh, generalSummaryKh, keyEventsKh, postureLabelKh, postureRationaleKh) MUST be written in Khmer language using the KHMER SCRIPT (ខ្មែរ) ONLY. Do NOT write in Thai script or English in these fields.
- Keep it short and clear for a broad local audience, but never compress meaning until it becomes vague.
- Prefer everyday concrete words. When a legal, military, or diplomatic term matters, keep the meaning and add a short plain explanation in the sentence.
- Use technical terms and acronyms only when they genuinely help accuracy. Otherwise, say what the thing means or why it matters in simple words.
- Choose the natural local phrase a thoughtful news editor would use in daily speech. Avoid textbook-style abstractions, word-for-word calques, and dramatic partisan wording.
- Preserve official names and place names when known; keep the same name consistent across Thai and Khmer fields.
- Use English numerals (0-9), not Thai or Khmer numerals.
- Prefer short sentences. One idea per sentence.`;

function buildGeminiStudioRequest(model: string, content: string, existingRequestId?: string): GeminiRequestInit {
    const requestId = existingRequestId || randomUUID();
    const projectName = GEMINI_PROJECT_NAME;
    const clientName = GEMINI_CLIENT_NAME;
    const resolvedModel = resolveGeminiModel(model);
    const body: GeminiRequestInit["body"] = {
        model: resolvedModel.model,
        messages: [{ role: "user", content }],
        project: projectName,
        client: clientName,
        request_id: requestId,
        metadata: {
            project: projectName,
            client: clientName,
        },
    };

    if (resolvedModel.thinkingLevel) {
        body.thinking_level = resolvedModel.thinkingLevel;
    }

    return {
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer anything",
            // Browser-like headers to bypass Cloudflare bot protection
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "X-Project-Name": projectName,
            "X-Client-Name": clientName,
            "X-Request-ID": requestId,
        },
        body,
        requestId,
    };
}

/**
 * Call the gemini-studio-api (OpenAI compatible)
 */
export async function callGeminiStudio(prompt: string, model: string, maxRetries: number = 4): Promise<string> {
    // 🗓️ INJECT CURRENT DATE (Bangkok Time)
    const bangkokDate = new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok", dateStyle: "full", timeStyle: "short" });
    const datedPrompt = `[CURRENT DATE: ${bangkokDate}]\n\n${prompt}`;

    const RETRY_DELAY = 8000; // 8 seconds - enough time for Cloudflare tunnel to reconnect

    const requestId = randomUUID();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const startTime = Date.now();

        // 3-minute timeout per request (Gemini can be slow on complex prompts)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000);

        try {
            const request = buildGeminiStudioRequest(model, datedPrompt, requestId);
            const response = await fetch(`${GEMINI_STUDIO_API_URL}/v1/chat/completions`, {
                method: "POST",
                headers: request.headers,
                body: JSON.stringify(request.body),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const duration = Date.now() - startTime;

            if (!response.ok) {
                const errorText = await response.text();
                console.warn(`[GEMINI] error status=${response.status} duration=${duration}ms requestId=${request.requestId} message=${errorText.substring(0, 100)}`);
                throw new Error(`API error (${response.status}): ${errorText.substring(0, 100)}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;

            if (!content) {
                throw new Error("API returned empty response content");
            }

            return content;

        } catch (error) {
            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;
            console.warn(`[GEMINI] attempt_failed attempt=${attempt}/${maxRetries} duration=${duration}ms requestId=${requestId} error=${error}`);

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
                const result = await callGeminiStudio(prompt, model, 1);

                if (modelIdx > 0) {
                    console.log(`[${debugLabel}] fallback_model_ok model=${model}`);
                }
                return result;

            } catch (error: any) {
                const errorMsg = error?.message || String(error);

                // Check if this is a rate limit error
                if (isRateLimitError(error)) {
                    console.warn(`[${debugLabel}] model_rate_limited model=${model} error=${errorMsg.substring(0, 80)}`);

                    if (!isLastModel) {
                        console.log(`[${debugLabel}] fallback_model from=${model} to=${fallbackChain[modelIdx + 1]}`);
                        break; // Skip remaining retries, move to next model
                    } else {
                        console.error(`[${debugLabel}] all_models_exhausted lastModel=${model}`);
                        throw new Error(`All models rate limited. Last error: ${errorMsg}`);
                    }
                }

                // Non-rate-limit error (network, timeout, etc.) - retry same model
                console.warn(`[${debugLabel}] model_error model=${model} attempt=${attempt}/${maxRetriesPerModel} error=${errorMsg.substring(0, 80)}`);

                if (attempt < maxRetriesPerModel) {
                    await new Promise(r => setTimeout(r, RETRY_DELAY));
                } else if (!isLastModel) {
                    console.log(`[${debugLabel}] fallback_model from=${model} to=${fallbackChain[modelIdx + 1]}`);
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
 * Extracts JSON from fenced ```json blocks first, then falls back to legacy tags/raw braces
 * Uses model fallback for thinking model (critical chain: thinking-high -> pro-high -> fast-high)
 */
export async function callGeminiStudioWithSelfHealing<T>(
    prompt: string,
    modelType: keyof typeof MODELS = "thinking",
    maxRetries: number = 3,
    debugLabel: string = "AI"
): Promise<T | null> {
    let currentPrompt = prompt;
    const startedAt = Date.now();
    const unwrapJsonStringEnvelope = (input: string): string => {
        const trimmed = input.trim();
        if (!trimmed.startsWith("\"")) return input;

        try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed === "string") {
                return parsed;
            }
        } catch {
            // Fall through to normal cleanup path.
        }

        return input;
    };

    const normalizeJsonCandidate = (input: string): string => {
        let normalized = unwrapJsonStringEnvelope(input).trim();

        for (let i = 0; i < 2; i++) {
            normalized = normalized
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
                .replace(/\\<json>/gi, "<json>")
                .replace(/\\<\/json>/gi, "</json>")
                .replace(/"\[([^\]]*)\]\(([^)]+)\)"/g, '"$2"')
                .replace(/,\s*([\]\}])/g, '$1')
                .replace(/[\uFEFF\u200B\u200C\u200D]/g, '')
                .replace(/\\(?=[!<>&`])/g, "")
                .replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
        }

        return normalized;
    };

    // Use fallback chain for thinking model (critical tasks)
    const useFallback = modelType === "thinking";
    const fallbackChain = useFallback ? FALLBACK_CHAINS.critical : [MODELS[modelType]];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let rawResponse = "";
        try {
            if (attempt > 1) {
                console.log(`[${debugLabel}] retrying_json_call attempt=${attempt}/${maxRetries}`);
            }

            // 1. CALL API - use fallback for thinking model
            try {
                if (useFallback) {
                    rawResponse = await callGeminiStudioWithFallback(currentPrompt, fallbackChain, 2, debugLabel);
                } else {
                    rawResponse = await callGeminiStudio(currentPrompt, MODELS[modelType], 1);
                }
                rawResponse = rawResponse
                    .replace(/\\<json>/gi, "<json>")
                    .replace(/\\<\/json>/gi, "</json>");
            } catch (networkError: any) {
                console.warn(`[${debugLabel}] api_error error=${networkError.message}`);
                throw networkError;
            }

            // 2. EXTRACT JSON
            let jsonStr: string | null = null;
            const fencedMatch = rawResponse.match(/```json\s*([\s\S]*?)```/i);
            const tagMatch = rawResponse.match(/<json>([\s\S]*?)<\/json>/i);
            if (fencedMatch) {
                jsonStr = fencedMatch[1].trim();
            } else if (tagMatch) {
                jsonStr = tagMatch[1].trim();
            } else {
                const cleanedResponse = rawResponse
                    .replace(/```json\s*/gi, "").replace(/```\s*/g, "")
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
                const parsed = JSON.parse(normalizeJsonCandidate(jsonStr)) as T;
                console.log(`[${debugLabel}] ok attempt=${attempt}/${maxRetries} duration=${Date.now() - startedAt}ms responseChars=${rawResponse.length}`);
                return parsed;
            } catch (parseError: any) {
                if (attempt < maxRetries) {
                    currentPrompt = `Your previous response had invalid JSON.

Return EXACTLY one fenced \`\`\`json code block and NOTHING else.
Inside the fence, output valid JSON only.
Do NOT include prose, apologies, markdown, or follow-up questions.

ERROR: ${parseError.message}

RESPONSE:
${rawResponse.substring(0, 1000)}`;
                    continue;
                } else throw parseError;
            }
        } catch (e: any) {
            console.error(`[${debugLabel}] failed attempt=${attempt}/${maxRetries} error=${e.message}`);
            // Add delay for network errors to give Cloudflare tunnel time to reconnect
            if (attempt < maxRetries) {
                console.log(`[${debugLabel}] retry_wait delay=8s`);
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
