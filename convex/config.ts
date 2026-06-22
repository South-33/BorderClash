// =============================================================================
// SHARED CONFIG - Change API URL here
// =============================================================================

// The URL for your gemini-studio-api instance (local or Cloudflare tunnel)
export const GEMINI_STUDIO_API_URL = process.env.GEMINI_STUDIO_API_URL || "http://localhost:8001";

// Request source attribution for Gemini Studio API traceability
export const GEMINI_PROJECT_NAME = process.env.GEMINI_PROJECT_NAME || "borderclash";
export const GEMINI_CLIENT_NAME = process.env.GEMINI_CLIENT_NAME || "borderclash-convex";

// Model roles - suffixes are resolved by ai_utils into model + thinking_level.
// "*-high" maps to Gemini Studio Extended thinking.
export const MODELS = {
    // Semantic step roles
    curation: "fast-high",       // Gemini Flash Lite with Extended thinking
    verification: "thinking-high", // Gemini 3.5 Flash with Extended thinking
    historian: "thinking-high",    // Gemini 3.5 Flash with Extended thinking
    synthesis: "thinking-high",    // Gemini 3.5 Flash with Extended thinking
    proFallback: "pro-high",       // Pro fallback with Extended thinking
    liteFallback: "fast-high",     // Flash Lite fallback with Extended thinking

    // Backwards compatibility aliases for tests:
    thinking: "thinking-high",
    pro: "thinking-standard",
    fast: "fast-high",
} as const;

// Fallback chains for rate limit recovery
// Critical tasks prefer Gemini 3.5 Flash Extended, then fall back only if needed.
// Curation uses Flash Lite Extended.
export const FALLBACK_CHAINS = {
    critical: [MODELS.thinking, MODELS.pro, MODELS.curation], // Agent/Historian/Synthesis/verification
    standard: [MODELS.thinking],                              // Planner, JSON repair, general tasks
    curation: [MODELS.curation],
} as const;
