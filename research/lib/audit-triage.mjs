function compactLead(lead) {
  if (!lead) return null;
  return {
    id: lead.id || "",
    source: lead.source || "",
    title: lead.title || "",
    captureFound: Boolean(lead.captureFound),
    captureStatus: lead.captureStatus || "",
    captureQuality: lead.captureQuality || "",
  };
}

export function classifyAuditTriage(candidate, recovery) {
  const diagnosis = recovery?.diagnosis || {};
  const exactTime = diagnosis.exactTime || {};
  const selectedLead = compactLead(recovery?.selectedLead);
  let disposition = "inspect";
  if (recovery?.recoveryState === "no-recoverable-lead") {
    disposition = "unresolved-candidate";
  } else if (selectedLead?.captureFound && recovery?.recoveryState !== "not-needed") {
    disposition = "replacement-ready";
  } else if (diagnosis.evidenceState === "time-unsupported") {
    disposition = "time-only";
  } else if (diagnosis.evidenceState === "ready" || recovery?.recoveryState === "not-needed") {
    disposition = "ready";
  }

  return {
    id: candidate.id,
    date: candidate.date,
    title: candidate.title,
    timeOfDay: candidate.timeOfDay ?? null,
    importance: candidate.importance ?? null,
    disposition,
    recoveryState: recovery?.recoveryState || "",
    evidenceState: diagnosis.evidenceState || "",
    nextAction: diagnosis.nextAction || "",
    exactTimeSupported: exactTime.supported === true,
    selectedLead,
    attemptedCount: Number(recovery?.attemptedCount || 0),
    citedEvidence: (diagnosis.citedEvidence || []).map((item) => ({
      id: item.id,
      source: item.source || "",
      captureFound: Boolean(item.captureFound),
      captureStatus: item.captureStatus || "",
      captureQuality: item.captureQuality || "",
    })),
  };
}

export async function mapWithConcurrency(items, concurrency, worker) {
  const width = Math.max(1, Number(concurrency) || 1);
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(width, items.length) }, runWorker));
  return results;
}
