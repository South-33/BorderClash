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
    curation: "flash-lite-standard",       // Gemini Flash Lite Standard is reliable for large curation prompts
    verification: "flash-standard",        // Flash Standard was reliable in live structured verification
    historian: "flash-standard",           // Flash Standard avoids repeated marker failures on large Historian jobs
    synthesis: "flash-standard",           // Flash Standard first; Pro Standard remains the quality fallback
    proFallback: "pro-standard",           // Pro Standard is the reliable quality fallback
    liteFallback: "flash-lite-standard",   // Flash Lite Standard is the final lightweight fallback

    // Clean aliases:
    thinking: "flash-standard",
    pro: "pro-standard",
    fast: "flash-lite-standard",
} as const;

// Fallback chains for rate limit recovery
// Automated research starts with Standard thinking because the audited live cycle showed Extended repeatedly missing the acceptance marker on large structured jobs.
// Pro Standard is the quality fallback; curation stays on Flash Lite Standard.
export const FALLBACK_CHAINS = {
    critical: [MODELS.thinking, MODELS.pro, MODELS.curation], // Agent/Historian/Synthesis/verification
    standard: [MODELS.thinking],                              // Planner, JSON repair, general tasks
    curation: [MODELS.curation],
} as const;
