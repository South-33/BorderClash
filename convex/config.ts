// =============================================================================
// SHARED CONFIG - Change API URL here to switch between local and Koyeb
// =============================================================================

// ⚡ SWITCH HERE: Comment/uncomment to toggle between local and Koyeb
// For LOCAL development (ngrok):
export const GHOST_API_URL = process.env.GHOST_API_URL || "http://localhost:8080";

// For KOYEB production (uncomment this and comment out the line above):
// export const GHOST_API_URL = process.env.GHOST_API_URL_KOYEB || "https://your-koyeb-app.koyeb.app";
