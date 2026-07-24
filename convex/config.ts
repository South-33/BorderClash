// =============================================================================
// SHARED CONFIG - Change API URL here
// =============================================================================

// The URL for your gemini-studio-api instance (local or Cloudflare tunnel)
export const GEMINI_STUDIO_API_URL = process.env.GEMINI_STUDIO_API_URL || "http://localhost:8001";

// Request source attribution for Gemini Studio API traceability
export const GEMINI_PROJECT_NAME = process.env.GEMINI_PROJECT_NAME || "borderclash";
export const GEMINI_CLIENT_NAME = process.env.GEMINI_CLIENT_NAME || "borderclash-convex";

// Model roles - suffixes are resolved by ai_utils into model + thinking_level.
// "*-extended" (and the legacy "*-high" alias) maps to Gemini Studio Extended thinking.
export const MODELS = {
    // Semantic step roles
    curation: "flash-lite-extended",       // Gemini Flash Lite with Extended thinking
    verification: "flash-extended",        // Gemini Flash with Extended thinking
    historian: "flash-extended",           // Gemini Flash with Extended thinking
    synthesis: "flash-extended",           // Gemini Flash with Extended thinking
    proFallback: "pro-extended",           // Pro fallback with Extended thinking
    liteFallback: "flash-lite-extended",   // Flash Lite fallback with Extended thinking

    // Clean aliases:
    thinking: "flash-extended",
    pro: "pro-standard",
    fast: "flash-lite-extended",
} as const;

// Fallback chains for rate limit recovery
// Critical tasks prefer Gemini Flash Extended, then fall back only if needed.
// Curation uses Flash Lite Extended.
export const FALLBACK_CHAINS = {
    critical: [MODELS.thinking, MODELS.pro, MODELS.curation], // Agent/Historian/Synthesis/verification
    standard: [MODELS.thinking],                              // Planner, JSON repair, general tasks
    curation: [MODELS.curation],
} as const;
