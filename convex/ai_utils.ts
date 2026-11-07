"use node";

import { randomUUID } from "node:crypto";

import {
    GEMINI_CLIENT_NAME,
    GEMINI_MEDIUM_FALLBACK,
    GEMINI_MODEL,
    GEMINI_PROJECT_NAME,
    GEMINI_STUDIO_API_URL,
    GEMINI_STUDIO_CONTROL_URL,
    GEMINI_THINKING,
    type GeminiThinkingLevel,
} from "./config";
import {
    isValidLocalizedText,
    type LocalizedLanguage,
} from "./language_quality";

type GeminiRequestInit = {
    headers: Record<string, string>;
    body: {
        model: typeof GEMINI_MODEL;
        thinking_level: GeminiThinkingLevel;
        fallback_thinking_level?: GeminiThinkingLevel;
        messages: Array<{ role: "user"; content: string }>;
        project: string;
        client: string;
        request_id: string;
        async?: boolean;
        use_search?: boolean;
        metadata: {
            project: string;
            client: string;
        };
    };
    requestId: string;
};

const GEMINI_REQUEST_TIMEOUT_MS = 510_000;
const GEMINI_POLL_INTERVAL_MS = 5_000;
const GEMINI_ENDPOINT_CACHE_MS = 30 * 60 * 1000;
const GEMINI_ENDPOINT_DISCOVERY_TIMEOUT_MS = 8_000;

let geminiEndpointCache: { url: string; resolvedAt: number } | null = null;

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, "");

async function resolveGeminiDataPlane(
    parentSignal: AbortSignal,
    forceRefresh: boolean = false,
): Promise<string> {
    const now = Date.now();
    if (!forceRefresh && geminiEndpointCache && now - geminiEndpointCache.resolvedAt < GEMINI_ENDPOINT_CACHE_MS) {
        return geminiEndpointCache.url;
    }

    const controlUrl = normalizeBaseUrl(GEMINI_STUDIO_CONTROL_URL);
    const discoveryController = new AbortController();
    const abortDiscovery = () => discoveryController.abort();
    parentSignal.addEventListener("abort", abortDiscovery, { once: true });
    const discoveryTimeout = setTimeout(() => discoveryController.abort(), GEMINI_ENDPOINT_DISCOVERY_TIMEOUT_MS);

    try {
        const response = await fetch(`${controlUrl}/v1/endpoint`, {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "ngrok-skip-browser-warning": "true",
                "X-Project-Name": GEMINI_PROJECT_NAME,
                "X-Client-Name": GEMINI_CLIENT_NAME,
            },
            signal: discoveryController.signal,
        });
        if (response.ok) {
            const payload = await response.json();
            const candidate = typeof payload?.data_plane_url === "string"
                ? normalizeBaseUrl(payload.data_plane_url)
                : "";
            const allowedDataPlane = candidate === controlUrl
                || /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i.test(candidate)
                || (controlUrl.startsWith("http://localhost") && candidate.startsWith("http://localhost"));
            if (allowedDataPlane) {
                geminiEndpointCache = { url: candidate, resolvedAt: now };
                return candidate;
            }
        }
    } catch (error) {
        if (parentSignal.aborted) throw error;
        if (geminiEndpointCache) return geminiEndpointCache.url;
    } finally {
        clearTimeout(discoveryTimeout);
        parentSignal.removeEventListener("abort", abortDiscovery);
    }

    return geminiEndpointCache?.url || controlUrl || normalizeBaseUrl(GEMINI_STUDIO_API_URL);
}

type GeminiCallOptions = {
    timeoutMs?: number;
    useSearch?: boolean;
    thinkingLevel: GeminiThinkingLevel;
};

/**
 * The Gemini API owns browser-level retries. A "Gemini request failed" error
 * means that server retry budget is already exhausted, so repeating the same
 * call immediately in BorderClash only multiplies an upstream outage.
 */
export function isCompletedGeminiFailure(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();
    return normalized.includes("gemini request failed:")
        || normalized.includes("gemini async job exceeded")
        || normalized.includes("gemini async job disappeared after submission");
}

function buildGeminiStudioRequest(
    content: string,
    thinkingLevel: GeminiThinkingLevel,
    existingRequestId?: string,
    useSearch: boolean = false,
): GeminiRequestInit {
    const requestId = existingRequestId || randomUUID();
    const projectName = GEMINI_PROJECT_NAME;
    const clientName = GEMINI_CLIENT_NAME;

    const body: GeminiRequestInit["body"] = {
        model: GEMINI_MODEL,
        thinking_level: thinkingLevel,
        messages: [{ role: "user", content }],
        project: projectName,
        client: clientName,
        request_id: requestId,
        metadata: {
            project: projectName,
            client: clientName,
        },
    };

    if (useSearch) {
        body.use_search = true;
    }
    if (thinkingLevel === "medium") {
        body.fallback_thinking_level = GEMINI_MEDIUM_FALLBACK;
    }

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
export async function callGeminiStudio(
    prompt: string,
    options: GeminiCallOptions,
): Promise<string> {
    // 🗓️ INJECT CURRENT DATE (Bangkok Time)
    const bangkokDate = new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok", dateStyle: "full", timeStyle: "short" });
    const datedPrompt = `[CURRENT DATE: ${bangkokDate}]\n\n${prompt}`;

    const requestId = randomUUID();
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? GEMINI_REQUEST_TIMEOUT_MS;
    const deadline = startTime + timeoutMs;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const readCompletion = (data: any): string => {
        const content = data?.choices?.[0]?.message?.content;
        if (!content) throw new Error("API returned empty response content");
        return content;
    };

    const fetchWithTransientRetry = async (
        path: string,
        init: RequestInit,
        { allowNotFound = false }: { allowNotFound?: boolean } = {},
    ): Promise<Response> => {
        let lastError: unknown;
        let lastResponse: Response | null = null;

        for (let attempt = 1; attempt <= 5; attempt++) {
            const baseUrl = attempt === 1
                ? await resolveGeminiDataPlane(controller.signal)
                : attempt === 2
                    ? await resolveGeminiDataPlane(controller.signal, true)
                    : normalizeBaseUrl(GEMINI_STUDIO_CONTROL_URL);
            try {
                const response = await fetch(`${baseUrl}${path}`, { ...init, signal: controller.signal });
                lastResponse = response;
                const transientStatus = response.status === 502
                    || response.status === 503
                    || response.status === 504
                    || (response.status >= 520 && response.status <= 530)
                    || (allowNotFound && response.status === 404);
                if (!transientStatus || attempt === 5) return response;
                await response.text().catch(() => "");
            } catch (error) {
                lastError = error;
                if (controller.signal.aborted || attempt === 5) throw error;
            }

            const remaining = deadline - Date.now();
            if (remaining <= 0) break;
            await new Promise(resolve => setTimeout(resolve, Math.min(2000 * attempt, 6000, remaining)));
        }

        if (lastResponse) return lastResponse;
        throw lastError instanceof Error ? lastError : new Error("Gemini API transport retry exhausted");
    };

    try {
        const request = buildGeminiStudioRequest(datedPrompt, options.thinkingLevel, requestId, options.useSearch ?? false);
        request.body.async = true;
        const submitRequest = async (): Promise<string | null> => {
            const response = await fetchWithTransientRetry("/v1/chat/completions", {
                method: "POST",
                headers: request.headers,
                body: JSON.stringify(request.body),
            }, { allowNotFound: true });

            if (!response.ok) {
                const errorText = await response.text();
                const duration = Date.now() - startTime;
                console.warn(`[GEMINI] submit_error status=${response.status} duration=${duration}ms requestId=${request.requestId} message=${errorText.substring(0, 100)}`);
                throw new Error(`API error (${response.status}): ${errorText.substring(0, 100)}`);
            }

            // Backward compatibility for an older server that completes inline.
            if (response.status !== 202) {
                return readCompletion(await response.json());
            }

            const accepted = await response.json();
            if (accepted?.request_id && accepted.request_id !== request.requestId) {
                throw new Error(`API returned mismatched request_id ${accepted.request_id}`);
            }
            return null;
        };

        const inlineContent = await submitRequest();
        if (inlineContent) return inlineContent;

        let consecutiveNotFound = 0;
        let resubmittedAfterRestart = false;
        while (Date.now() < deadline) {
            const remaining = deadline - Date.now();
            await new Promise(resolve => setTimeout(resolve, Math.min(GEMINI_POLL_INTERVAL_MS, remaining)));

            let poll: Response;
            try {
                poll = await fetchWithTransientRetry(
                    `/v1/chat/completions/${encodeURIComponent(request.requestId)}`,
                    { method: "GET", headers: request.headers },
                    { allowNotFound: true },
                );
            } catch (pollTransportError) {
                // Submission already succeeded and the browser job may still be
                // running. A quick-tunnel rotation or brief control-plane outage
                // must not orphan that in-flight request. Clear endpoint cache
                // and keep polling the SAME request id until the overall budget
                // expires; never resubmit merely because transport disappeared.
                if (controller.signal.aborted) throw pollTransportError;
                geminiEndpointCache = null;
                console.warn(`[GEMINI] poll_transport_error retry_same_job=true duration=${Date.now() - startTime}ms requestId=${request.requestId} message=${pollTransportError instanceof Error ? pollTransportError.message : String(pollTransportError)}`);
                continue;
            }

            if (poll.status === 202) {
                consecutiveNotFound = 0;
                continue;
            }
            if (poll.status === 404) {
                consecutiveNotFound++;
                if (consecutiveNotFound < 2) continue;
                if (!resubmittedAfterRestart) {
                    // Async jobs live in the API process. If that process is
                    // restarted while Gemini is working, the transport can
                    // recover while the in-memory job record disappears.
                    // Resubmit the same logical request once instead of
                    // failing the entire research cycle.
                    console.warn(`[GEMINI] async_job_missing resubmit=true requestId=${request.requestId}`);
                    geminiEndpointCache = null;
                    const recoveredInlineContent = await submitRequest();
                    if (recoveredInlineContent) return recoveredInlineContent;
                    resubmittedAfterRestart = true;
                    consecutiveNotFound = 0;
                    continue;
                }
                throw new Error("Gemini async job disappeared after submission");
            }
            if (!poll.ok) {
                const errorText = await poll.text();
                console.warn(`[GEMINI] poll_error status=${poll.status} duration=${Date.now() - startTime}ms requestId=${request.requestId} message=${errorText.substring(0, 100)}`);
                throw new Error(`API error (${poll.status}): ${errorText.substring(0, 100)}`);
            }

            const data = await poll.json();
            if (data?.status === "failed" || data?.status === "error" || data?.status === "timeout") {
                throw new Error(`Gemini request failed: ${data.error || data.status}`);
            }

            const content = readCompletion(data);
            console.log(`[GEMINI] ok duration=${Date.now() - startTime}ms requestId=${request.requestId}`);
            return content;
        }

        throw new Error(`Gemini async job exceeded ${timeoutMs}ms polling budget`);
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
    options: GeminiCallOptions,
    maxRetries: number = 3,
    debugLabel: string = "AI",
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
                rawResponse = await callGeminiStudio(currentPrompt, options);
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
            if (isCompletedGeminiFailure(e)) {
                console.warn(`[${debugLabel}] server_retry_budget_exhausted localRetry=false`);
                return null;
            }
            // Add delay for network errors to give Cloudflare tunnel time to reconnect
            if (attempt < maxRetries) {
                console.log(`[${debugLabel}] retry_wait delay=8s`);
                await new Promise(resolve => setTimeout(resolve, 8000));
            }
        }
    }
    return null;
}

export type LocalizedRepairItem = {
    id: string;
    english: string;
    repair: LocalizedLanguage[];
};

export type LocalizedRepairResult = {
    id: string;
    thai?: string;
    khmer?: string;
};

/**
 * Repair only localized text that failed deterministic validation. Clean
 * generations pay no extra Gemini cost. The English text is the source of
 * meaning; the rejected translation is intentionally not echoed back into
 * the repair prompt so wrong-script fragments cannot contaminate the retry.
 */
export async function repairLocalizedItems(
    items: LocalizedRepairItem[],
    timeoutMs?: number,
    thinkingLevel: GeminiThinkingLevel = GEMINI_THINKING.repair,
): Promise<Map<string, LocalizedRepairResult>> {
    if (items.length === 0) return new Map();

    // Convex event IDs add no translation context. Use compact per-request
    // IDs so bounded repair batches stay in Gemini's inline composer, then
    // map validated outputs back to the real IDs before persistence.
    const promptItems = items.map((item, index) => ({
        id: String(index + 1),
        english: item.english,
        repair: item.repair,
    }));

    // Keep fallback repair prompts compact. Bounded maintenance batches can
    // then stay in Gemini's normal composer instead of becoming file uploads,
    // while preserving the same factual, neutral, and script constraints.
    const prompt = `Translate only requested BorderClash fields from English.
- Keep facts, numbers, attribution and uncertainty unchanged; add, remove, strengthen or weaken nothing.
- th: natural everyday Thai, no Khmer script. kh: natural everyday Khmer, no Thai script.
- Use normal local country/place names and neutral plain language; no side-taking, reader address, slang, cheering or hype. Explain jargon plainly.
INPUT:
${JSON.stringify(promptItems)}
Return only this fenced JSON shape:
\`\`\`json
{"items":[{"id":"same","thai":"if th","khmer":"if kh"}]}
\`\`\`
Include every id and only requested languages.`;

    const result = await callGeminiStudioWithSelfHealing<{ items?: LocalizedRepairResult[] }>(
        prompt,
        { thinkingLevel, timeoutMs },
        1,
        "LOCALIZATION-REPAIR",
    );

    const requestedByPromptId = new Map(promptItems.map((item, index) => [item.id, items[index]]));
    const repaired = new Map<string, LocalizedRepairResult>();
    for (const item of result?.items || []) {
        const requested = requestedByPromptId.get(item.id);
        if (!requested) continue;

        const clean: LocalizedRepairResult = { id: requested.id };
        if (requested.repair.includes("th") && isValidLocalizedText(item.thai, "th")) {
            clean.thai = item.thai;
        }
        if (requested.repair.includes("kh") && isValidLocalizedText(item.khmer, "kh")) {
            clean.khmer = item.khmer;
        }
        repaired.set(requested.id, clean);
    }

    return repaired;
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
    const sources = sortedSources.slice(0, 2).map((s: any) => `${s.name}(${s.credibility})`).join(" | ") || "(none)";
    const trans = (e.titleTh && e.titleKh) ? "✓" : "⚠️needs-trans";
    const prefix = idx !== undefined ? `${idx + 1}. ` : "";
    return `${prefix}[${e.date}${time}] "${e.title}" (${e.status}, ${e.category}, imp:${e.importance}) [${trans}]
   ${e.description}
   Sources: ${sources}`;
}
