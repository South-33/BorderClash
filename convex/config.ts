// =============================================================================
// SHARED CONFIG - Change API URL here
// =============================================================================

// The URL for your gemini-studio-api instance (local or Cloudflare tunnel)
export const GEMINI_STUDIO_API_URL = process.env.GEMINI_STUDIO_API_URL || "http://localhost:8001";

// Model roles - change the values here to swap models across the entire app
export const MODELS = {
    fast: "fast",         // Used for: news curation, quick tasks
    thinking: "thinking", // Used for: synthesis, historian, verification, analysis
};
