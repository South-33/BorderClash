export const GEMINI_STUDIO_API_URL = process.env.GEMINI_STUDIO_API_URL || "http://localhost:8001";
export const GEMINI_PROJECT_NAME = process.env.GEMINI_PROJECT_NAME || "borderclash";
export const GEMINI_CLIENT_NAME = process.env.GEMINI_CLIENT_NAME || "borderclash-convex";

export type GeminiModel = "flash" | "flash-lite" | "pro";
export type GeminiThinkingLevel = "low" | "medium" | "high";
export type GeminiModelConfig = Readonly<{
    model: GeminiModel;
    thinkingLevel: GeminiThinkingLevel;
}>;

// Keep model choice explicit. gemini-studio-api accepts only these model
// families and Low/Medium/High thinking levels; there are no suffix aliases.
export const MODELS = {
    curation: { model: "flash-lite", thinkingLevel: "medium" },
    verification: { model: "flash", thinkingLevel: "medium" },
    historian: { model: "flash", thinkingLevel: "medium" },
    synthesis: { model: "flash", thinkingLevel: "medium" },
    planner: { model: "flash", thinkingLevel: "medium" },
    proFallback: { model: "pro", thinkingLevel: "medium" },
} as const satisfies Record<string, GeminiModelConfig>;

export const FALLBACK_CHAINS = {
    critical: [MODELS.verification, MODELS.proFallback, MODELS.curation],
} as const;
