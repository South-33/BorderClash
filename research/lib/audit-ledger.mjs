import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import { listFiles, readJson, readJsonl, writeJson } from "./files.mjs";

export const AUDIT_STATUSES = new Set(["pending", "reviewed", "corrected", "merged", "unresolved"]);
export const PRIORITY_EVENT_IDS = new Map([
  ["ks7e2x0gqj1y7sydt8aft48ep187n8vk", { priority: 1, reason: "known retrospective-year chronology error" }],
  ["ks7ayq8ftpg07hbm1ctezm4rr5812w3s", { priority: 2, reason: "known humanitarian claimant/scope review" }],
  ["ks701ya5evqycp609frpy3rmtd8133ss", { priority: 2.5, reason: "humanitarian stored-summary numeric mismatch triage" }],
  ["ks79yfakf2xfv51r79bk82ya258128kj", { priority: 2.5, reason: "humanitarian stored-summary numeric mismatch triage" }],
]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
  );
}

export function recordFingerprint(value) {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

function currentPriority(id) {
  if (id.startsWith("current/")) return { priority: 0, priorityReason: "current public synthesis" };
  const known = PRIORITY_EVENT_IDS.get(id);
  if (known) return { priority: known.priority, priorityReason: known.reason };
  return null;
}

function descriptor(kind, file, value) {
  const id = kind === "current" ? "current/" + file.replace(/^.*[\\/]/u, "").replace(/\.json$/u, "") : value.id;
  const explicit = currentPriority(id);
  const priority = explicit?.priority
    ?? (kind === "timeline" && Number(value.importance || 0) >= 70 ? 3 : kind === "timeline" ? 4 : 5);
  const priorityReason = explicit?.priorityReason
    ?? (kind === "timeline" && Number(value.importance || 0) >= 70 ? "high-importance timeline event" : "");
  return {
    id,
    kind,
    file: file.replaceAll("\\", "/"),
    month: kind === "current" ? "" : file.match(/(\d{4}-\d{2})\.jsonl$/u)?.[1] || "",
    date: kind === "timeline" ? String(value.date || "") : "",
    importance: kind === "timeline" ? Number(value.importance || 0) : null,
    priority,
    priorityReason,
    fingerprint: recordFingerprint(value),
  };
}

export async function loadAuditRecords(dataRoot = "data") {
  const records = [];
  for (const name of ["summary", "thailand", "cambodia", "impact"]) {
    const file = join(dataRoot, "current", name + ".json");
    records.push(descriptor("current", relative(dataRoot, file), await readJson(file)));
  }
  for (const kind of ["timeline", "news"]) {
    for (const file of await listFiles(join(dataRoot, kind), ".jsonl")) {
      for (const row of await readJsonl(file)) {
        records.push(descriptor(kind, relative(dataRoot, file), row));
      }
    }
  }
  const seen = new Set();
  for (const record of records) {
    if (!record.id) throw new Error("audit record is missing a stable id: " + record.file);
    if (seen.has(record.id)) throw new Error("duplicate audit record id: " + record.id);
    seen.add(record.id);
  }
  return records;
}

function itemFromRecord(record) {
  return {
    ...record,
    present: true,
    status: "pending",
    note: "",
    checkedAt: null,
    reviewedFingerprint: null,
    history: [],
  };
}

export function createAuditLedger(records, { anchorCommit, now = Date.now() } = {}) {
  if (!anchorCommit) throw new Error("audit ledger requires an anchor commit");
  return {
    schemaVersion: 1,
    anchorCommit,
    currentCommit: anchorCommit,
    createdAt: now,
    updatedAt: now,
    items: records.map(itemFromRecord),
  };
}

function snapshotHistory(item, now, reason) {
  return {
    status: item.status,
    note: item.note,
    checkedAt: item.checkedAt,
    reviewedFingerprint: item.reviewedFingerprint,
    fingerprint: item.fingerprint,
    changedAt: now,
    reason,
  };
}

export function syncAuditLedger(ledger, records, { commit, now = Date.now() } = {}) {
  if (!ledger || ledger.schemaVersion !== 1 || !Array.isArray(ledger.items)) throw new Error("invalid audit ledger");
  if (!commit) throw new Error("audit sync requires the current commit");
  const currentById = new Map(records.map((record) => [record.id, record]));
  const existingById = new Map(ledger.items.map((item) => [item.id, item]));

  for (const record of records) {
    const item = existingById.get(record.id);
    if (!item) {
      ledger.items.push(itemFromRecord(record));
      continue;
    }
    if (item.fingerprint !== record.fingerprint) {
      item.history = [...(item.history || []), snapshotHistory(item, now, "content changed")];
      item.status = "pending";
      item.note = "Content changed since the previous audit state.";
      item.checkedAt = null;
      item.reviewedFingerprint = null;
    }
    Object.assign(item, record, { present: true });
  }

  for (const item of ledger.items) {
    if (currentById.has(item.id)) continue;
    if (item.present === false) continue;
    item.history = [...(item.history || []), snapshotHistory(item, now, "record absent after sync")];
    item.present = false;
    if (item.status !== "merged") {
      item.status = "pending";
      item.note = "Record is absent after sync and needs an explicit merged/unresolved disposition.";
      item.checkedAt = null;
      item.reviewedFingerprint = null;
    }
  }

  ledger.currentCommit = commit;
  ledger.updatedAt = now;
  return ledger;
}

export function markAuditItem(ledger, id, status, note = "", { now = Date.now() } = {}) {
  if (!AUDIT_STATUSES.has(status) || status === "pending") throw new Error("audit mark status must be reviewed, corrected, merged, or unresolved");
  const item = ledger.items.find((candidate) => candidate.id === id);
  if (!item) throw new Error("unknown audit record id: " + id);
  if (["merged", "unresolved"].includes(status) && !String(note).trim()) {
    throw new Error(status + " audit result requires a reason");
  }
  item.status = status;
  item.note = String(note || "").trim();
  item.checkedAt = now;
  item.reviewedFingerprint = item.fingerprint;
  ledger.updatedAt = now;
  return item;
}

export function nextAuditItems(ledger, limit = 25) {
  const count = Math.max(1, Math.min(200, Number(limit) || 25));
  return ledger.items
    .filter(({ status }) => status === "pending")
    .sort((a, b) => a.priority - b.priority || a.file.localeCompare(b.file) || a.id.localeCompare(b.id))
    .slice(0, count);
}

export function auditLedgerSummary(ledger) {
  const byStatus = Object.fromEntries([...AUDIT_STATUSES].map((status) => [status, 0]));
  const byKind = { current: 0, timeline: 0, news: 0 };
  let missing = 0;
  for (const item of ledger.items) {
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    byKind[item.kind] = (byKind[item.kind] || 0) + 1;
    if (item.present === false) missing += 1;
  }
  return {
    anchorCommit: ledger.anchorCommit,
    currentCommit: ledger.currentCommit,
    total: ledger.items.length,
    byStatus,
    byKind,
    missing,
    complete: byStatus.pending === 0,
    next: nextAuditItems(ledger, 10).map(({ id, kind, file, priorityReason }) => ({ id, kind, file, priorityReason })),
  };
}

export async function writeAuditLedger(path, ledger) {
  await writeJson(path, ledger);
}
