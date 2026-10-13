export const GEMINI_STUDIO_API_URL = process.env.GEMINI_STUDIO_API_URL || "http://localhost:8001";
export const GEMINI_PROJECT_NAME = process.env.GEMINI_PROJECT_NAME || "borderclash";
export const GEMINI_CLIENT_NAME = process.env.GEMINI_CLIENT_NAME || "borderclash-convex";

// BorderClash intentionally uses one stable Gemini configuration everywhere.
export const GEMINI_MODEL = "flash" as const;
export const GEMINI_THINKING_LEVEL = "medium" as const;
