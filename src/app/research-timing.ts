export const RESEARCH_RUNNING_GRACE_SECONDS = 20 * 60;
export const RESEARCH_RUNNING_CHECK_MS = 30_000;
export const RESEARCH_OVERDUE_CHECK_MS = 60_000;

export type ResearchTimerPhase =
  | { phase: 'countdown'; seconds: number }
  | { phase: 'running' }
  | { phase: 'overdue'; seconds: number };

export function getResearchTimerPhase(remainingSeconds: number): ResearchTimerPhase {
  if (remainingSeconds > 0) {
    return { phase: 'countdown', seconds: remainingSeconds };
  }
  if (remainingSeconds > -RESEARCH_RUNNING_GRACE_SECONDS) {
    return { phase: 'running' };
  }
  return {
    phase: 'overdue',
    seconds: Math.max(0, Math.abs(remainingSeconds) - RESEARCH_RUNNING_GRACE_SECONDS),
  };
}
