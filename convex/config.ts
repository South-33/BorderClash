// =============================================================================
// SHARED CONFIG - Change API URL here
// =============================================================================

// The URL for your gemini-studio-api instance (local or Cloudflare tunnel)
export const GEMINI_STUDIO_API_URL = process.env.GEMINI_STUDIO_API_URL || "http://localhost:8001";

// Model roles - change the values here to swap models across the entire app
export const MODELS = {
    fast: "fast",         // Used for: news curation, quick tasks
    thinking: "thinking", // Used for: synthesis, historian, verification, analysis
    pro: "pro",           // Used for: fallback when thinking is rate limited
};

// Fallback chains for rate limit recovery
// Critical tasks try thinking → pro → fast
// Standard tasks just use fast (infinite rate limits)
export const FALLBACK_CHAINS = {
    critical: ["thinking", "pro", "fast"],  // Agent/Historian/Synthesis
    standard: ["fast"],                     // Planner, JSON repair, curation
} as const;
