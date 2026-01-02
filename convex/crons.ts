import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// =============================================================================
// AUTOMATION - Full Research Cycle (runs every 12 hours)
// Runs: Curation -> Validation -> Dashboard -> Synthesis
// Changed to 720min (12h) to reduce bandwidth usage
// =============================================================================
crons.interval("research-cycle", { minutes: 720 }, internal.research.runResearchCycle);


export default crons;
