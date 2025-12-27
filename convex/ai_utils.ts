"use node";

import { GEMINI_STUDIO_API_URL, MODELS } from "./config";

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
            });

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
 * GENERIC SELF-HEALING HELPER
 * Handles retry logic and JSON repair
 * Extracts JSON from <json> tags first, then falls back to regex
 */
export async function callGeminiStudioWithSelfHealing<T>(
    prompt: string,
    modelType: keyof typeof MODELS = "thinking",
    maxRetries: number = 3,
    debugLabel: string = "AI"
): Promise<T | null> {
    let currentPrompt = prompt;
    const modelName = MODELS[modelType];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let rawResponse = "";
        try {
            console.log(`🤖 [${debugLabel}] Attempt ${attempt}/${maxRetries} (${modelName})...`);

            // 1. CALL API
            try {
                rawResponse = await callGeminiStudio(currentPrompt, modelName, 1);
            } catch (networkError: any) {
                console.log(`⚠️ [${debugLabel}] Error with API. Retrying...`);
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
