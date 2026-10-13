"use node";

import { randomUUID } from "node:crypto";

import {
    GEMINI_CLIENT_NAME,
    GEMINI_MODEL,
    GEMINI_PROJECT_NAME,
    GEMINI_STUDIO_API_URL,
    GEMINI_THINKING_LEVEL,
} from "./config";

type GeminiRequestInit = {
    headers: Record<string, string>;
    body: {
        model: typeof GEMINI_MODEL;
        thinking_level: typeof GEMINI_THINKING_LEVEL;
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

const GEMINI_REQUEST_TIMEOUT_MS = 510_000;

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

function buildGeminiStudioRequest(content: string, existingRequestId?: string): GeminiRequestInit {
    const requestId = existingRequestId || randomUUID();
    const projectName = GEMINI_PROJECT_NAME;
    const clientName = GEMINI_CLIENT_NAME;

    const body: GeminiRequestInit["body"] = {
        model: GEMINI_MODEL,
        thinking_level: GEMINI_THINKING_LEVEL,
        messages: [{ role: "user", content }],
        project: projectName,
        client: clientName,
        request_id: requestId,
        metadata: {
            project: projectName,
            client: clientName,
        },
    };

    return {
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer anything",
            "ngrok-skip-browser-warning": "true",
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
export async function callGeminiStudio(prompt: string, timeoutMs: number = GEMINI_REQUEST_TIMEOUT_MS): Promise<string> {
    // 🗓️ INJECT CURRENT DATE (Bangkok Time)
    const bangkokDate = new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok", dateStyle: "full", timeStyle: "short" });
    const datedPrompt = `[CURRENT DATE: ${bangkokDate}]\n\n${prompt}`;

    const requestId = randomUUID();
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const request = buildGeminiStudioRequest(datedPrompt, requestId);
        const response = await fetch(`${GEMINI_STUDIO_API_URL}/v1/chat/completions`, {
            method: "POST",
            headers: request.headers,
            body: JSON.stringify(request.body),
            signal: controller.signal,
        });

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
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * GENERIC SELF-HEALING HELPER
 * Handles retry logic and JSON repair
 * Extracts JSON from fenced ```json blocks first, then falls back to legacy tags/raw braces
 */
export async function callGeminiStudioWithSelfHealing<T>(
    prompt: string,
    maxRetries: number = 3,
    debugLabel: string = "AI",
    timeoutMs?: number
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

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let rawResponse = "";
        try {
            if (attempt > 1) {
                console.log(`[${debugLabel}] retrying_json_call attempt=${attempt}/${maxRetries}`);
            }

            // 1. CALL API
            try {
                rawResponse = await callGeminiStudio(currentPrompt, timeoutMs);
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
