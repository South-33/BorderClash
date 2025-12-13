import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// =============================================================================
// AUTOMATION - Full Research Cycle (runs every hour)
// Runs: Curation -> Validation -> Dashboard -> Synthesis
// =============================================================================
crons.interval("research-cycle", { minutes: 60 }, internal.research.runResearchCycle);

// =============================================================================
// GHOST API KEEPALIVE - Ping Koyeb to prevent instance sleep (every 10 minutes)
// =============================================================================
crons.interval("ghost-api-keepalive", { minutes: 10 }, internal.research.pingGhostAPI);

export default crons;
