// =============================================================================
// SHARED CONFIG - Change API URL here
// =============================================================================

// The URL for your gemini-studio-api instance (local or Cloudflare tunnel)
export const GEMINI_STUDIO_API_URL = process.env.GEMINI_STUDIO_API_URL || "http://localhost:8001";

export const MODELS = {
    curation: "thinking",    // All models now use thinking
    planner: "thinking",
    thinking: "thinking"
};
