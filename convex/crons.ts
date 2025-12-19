import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// =============================================================================
// AUTOMATION - Full Research Cycle (runs every 6 hours)
// Runs: Curation -> Validation -> Dashboard -> Synthesis
// Changed to 360min to reduce bandwidth usage
// =============================================================================
crons.interval("research-cycle", { minutes: 360 }, internal.research.runResearchCycle);


export default crons;
