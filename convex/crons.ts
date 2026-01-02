import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// =============================================================================
// ADAPTIVE SCHEDULER - Heartbeat runs every 4 hours
// Checks if nextRunAt has passed, then runs full cycle if needed
// AI decides next interval (4-48h) based on conflict activity
// =============================================================================
crons.interval("adaptive-scheduler", { hours: 4 }, internal.research.maybeRunCycle);


export default crons;
