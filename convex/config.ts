export const GEMINI_STUDIO_API_URL = process.env.GEMINI_STUDIO_API_URL || "http://localhost:8001";
export const GEMINI_PROJECT_NAME = process.env.GEMINI_PROJECT_NAME || "borderclash";
export const GEMINI_CLIENT_NAME = process.env.GEMINI_CLIENT_NAME || "borderclash-convex";

// BorderClash uses Gemini Flash only. Thinking is task-specific and limited to
// Medium or High. Keep these roles explicit so no call can silently fall back
// to Flash-Lite, Pro, or Low thinking.
export const GEMINI_MODEL = "flash" as const;
export const GEMINI_THINKING = {
    curation: "medium",
    planner: "medium",
    repair: "medium",
    verification: "high",
    historian: "high",
    synthesis: "high",
    manager: "high",
    impactRescore: "high",
    canonicalization: "high",
} as const;

// Gemini Web can transiently reject Medium while High remains available.
// Medium roles get one Medium browser attempt, then stay on Flash and promote
// only the remaining attempts to High. No other model family or thinking level
// is permitted.
export const GEMINI_MEDIUM_FALLBACK = "high" as const;

export type GeminiThinkingLevel = (typeof GEMINI_THINKING)[keyof typeof GEMINI_THINKING];
