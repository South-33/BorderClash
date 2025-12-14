import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// =============================================================================
// AUTOMATION - Full Research Cycle (runs every hour)
// Runs: Curation -> Validation -> Dashboard -> Synthesis
// =============================================================================
crons.interval("research-cycle", { minutes: 60 }, internal.research.runResearchCycle);

// =============================================================================
// GHOST API KEEPALIVE - Ping Koyeb to prevent instance sleep (every 4 minutes)
// Koyeb idle period is 5 min, so ping every 4 min keeps it awake
// =============================================================================
crons.interval("ghost-api-keepalive", { minutes: 4 }, internal.research.pingGhostAPI);

export default crons;
