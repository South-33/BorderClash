import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// =============================================================================
// STUCK CYCLE WATCHDOG - Runs every 10 minutes
// Recovers from timed-out cycles that never reached scheduling/finalization.
// =============================================================================
crons.interval("cycle-recovery-watchdog", { minutes: 10 }, internal.research.recoverStuckCycle);

// =============================================================================
// SAFETY NET - Runs every 24 hours as fallback ONLY
// Primary scheduling uses scheduler.runAt() for precise timing
// This only triggers if the scheduled job somehow gets lost
// =============================================================================
crons.interval("scheduler-safety-net", { hours: 24 }, internal.research.maybeRunCycle);

// =============================================================================
// MONTHLY CLEANUP - Delete archived articles older than 1 year
// Prevents unbounded storage growth while preserving lifetime counters
// =============================================================================
crons.monthly("cleanup-old-articles", { day: 1, hourUTC: 0, minuteUTC: 0 }, internal.api.cleanupOldArticles);

export default crons;
