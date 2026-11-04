export const GEMINI_STUDIO_API_URL = process.env.GEMINI_STUDIO_API_URL || "http://localhost:8001";
export const GEMINI_PROJECT_NAME = process.env.GEMINI_PROJECT_NAME || "borderclash";
export const GEMINI_CLIENT_NAME = process.env.GEMINI_CLIENT_NAME || "borderclash-convex";

// BorderClash intentionally uses one stable Gemini configuration everywhere.
// Flash Medium is currently returning Gemini's generic failure response on the
// production web session; Flash-Lite Low is the verified recovery profile.
export const GEMINI_MODEL = "flash-lite" as const;
export const GEMINI_THINKING_LEVEL = "low" as const;
