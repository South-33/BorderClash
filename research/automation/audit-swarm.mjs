import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAuditClaims, parseWorktreePorcelain } from "../lib/audit-worktree-claims.mjs";

const DEFAULT_WORKERS = 4;
const MAX_WORKERS = 8;
const DEFAULT_SCAN_LIMIT = 120;
const DEFAULT_MIN_GAP_DAYS = 3;
const INTEGRATION_LOCK_DIR = "integration-lock";

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = argv[i + 1];
    if (next == null || next.startsWith("--")) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    i += 1;
  }
  return { positional, options };
}

function git(cwd, args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
  if (!allowFailure && result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "git failed: " + args.join(" ")).trim());
  }
  return {
    ok: result.status === 0,
    stdout: String(result.stdout || "").trim(),
    stderr: String(result.stderr || "").trim(),
  };
}

function nodeJson(cwd, args) {
  return JSON.parse(execFileSync(process.execPath, args, { cwd, encoding: "utf8", windowsHide: true }));
}

export function parseJsonText(text) {
  return JSON.parse(String(text || "").replace(/^\uFEFF/u, ""));
}

function readJson(path) {
  return parseJsonText(readFileSync(path, "utf8"));
}

function pidIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "EPERM") return true;
    return false;
  }
}

export function integrationLockPath(primaryRoot) {
  return join(primaryRoot, ".work", "audit-swarm", INTEGRATION_LOCK_DIR);
}

export function acquireIntegrationLock(primaryRoot, {
  pid = process.pid,
  now = Date.now(),
  isPidAlive = pidIsAlive,
} = {}) {
  const lockPath = integrationLockPath(primaryRoot);
  const ownerPath = join(lockPath, "owner.json");
  mkdirSync(dirname(lockPath), { recursive: true });

  const create = () => {
    try {
      mkdirSync(lockPath);
    } catch (error) {
      if (error?.code === "EEXIST") return null;
      throw error;
    }
    const owner = {
      schemaVersion: 1,
      pid,
      startedAt: now,
      token: String(pid) + "-" + String(now),
    };
    try {
      writeJson(ownerPath, owner);
    } catch (error) {
      rmSync(lockPath, { recursive: true, force: true });
      throw error;
    }
    return { ok: true, lockPath, ownerPath, owner };
  };

  const fresh = create();
  if (fresh) return fresh;

  let owner = null;
  try {
    owner = readJson(ownerPath);
  } catch {
    return { ok: false, reason: "integration-lock-held", lockPath, owner: null };
  }
  if (isPidAlive(Number(owner?.pid))) {
    return { ok: false, reason: "integration-lock-held", lockPath, owner };
  }

  rmSync(lockPath, { recursive: true, force: true });
  const reclaimed = create();
  return reclaimed || { ok: false, reason: "integration-lock-held", lockPath, owner };
}

export function releaseIntegrationLock(lock) {
  if (!lock?.ok || !lock.lockPath || !lock.ownerPath) return false;
  let owner = null;
  try {
    owner = readJson(lock.ownerPath);
  } catch {
    return false;
  }
  if (owner?.token !== lock.owner?.token) return false;
  rmSync(lock.lockPath, { recursive: true, force: true });
  return true;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function normalized(path) {
  return resolve(String(path || "")).replaceAll("\\", "/").toLowerCase();
}

function sorted(values) {
  return [...values].map(String).sort();
}

function sameStrings(left, right) {
  const a = sorted(left);
  const b = sorted(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function changedJsonlIds(diffText) {
  const ids = new Set();
  for (const line of String(diffText || "").split(/\r?\n/u)) {
    if (!/^[+-]\{/u.test(line) || /^\+\+\+|^---/u.test(line)) continue;
    const match = line.match(/"id":"([^"]+)"/u);
    if (match) ids.add(match[1]);
  }
  return [...ids].sort();
}

function jsonlRows(text) {
  return String(text || "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(JSON.parse);
}

function rowMap(rows) {
  return new Map(rows.map((row) => [row.id, row]));
}

function sameRow(left, right) {
  if (left == null || right == null) return left == null && right == null;
  return JSON.stringify(left) === JSON.stringify(right);
}

export function mergeJsonlRecordText(baseText, workerText, primaryText) {
  const baseRows = jsonlRows(baseText);
  const workerRows = jsonlRows(workerText);
  const primaryRows = jsonlRows(primaryText);
  const base = rowMap(baseRows);
  const worker = rowMap(workerRows);
  const primary = rowMap(primaryRows);
  const ids = new Set([...base.keys(), ...worker.keys()]);
  const changedIds = [...ids].filter((id) => !sameRow(base.get(id), worker.get(id))).sort();
  const overlapIds = changedIds.filter((id) => !sameRow(base.get(id), primary.get(id)));
  if (overlapIds.length) {
    return { ok: false, text: primaryText, changedIds, overlapIds };
  }

  const workerById = new Map(workerRows.map((row) => [row.id, row]));
  const changed = new Set(changedIds);
  const output = [];
  const emitted = new Set();
  for (const row of primaryRows) {
    if (!changed.has(row.id)) {
      output.push(row);
      continue;
    }
    const replacement = workerById.get(row.id);
    if (replacement) {
      output.push(replacement);
      emitted.add(row.id);
    }
  }
  for (const row of workerRows) {
    if (changed.has(row.id) && !emitted.has(row.id) && !primary.has(row.id)) {
      output.push(row);
      emitted.add(row.id);
    }
  }
  return {
    ok: true,
    text: output.map((row) => JSON.stringify(row)).join("\n") + "\n",
    changedIds,
    overlapIds: [],
  };
}

export function jsonlWorkerChangesPresent(baseText, workerText, primaryText) {
  const base = rowMap(jsonlRows(baseText));
  const worker = rowMap(jsonlRows(workerText));
  const primary = rowMap(jsonlRows(primaryText));
  const ids = new Set([...base.keys(), ...worker.keys()]);
  const changedIds = [...ids].filter((id) => !sameRow(base.get(id), worker.get(id))).sort();
  return {
    ok: changedIds.every((id) => sameRow(worker.get(id), primary.get(id))),
    changedIds,
  };
}

export function validateWorkerResult({
  task,
  result,
  workerHead,
  workerDirty,
  commitCount,
  ownedClaimIds,
  resume,
}) {
  const issues = [];
  if (!task?.record?.id) issues.push("missing-task-record");
  if (!result) return { ready: false, state: "working", issues };
  if (Number(result.schemaVersion) !== 1) issues.push("unsupported-result-schema");
  if (result.recordId !== task?.record?.id) issues.push("record-id-mismatch");
  const ledger = Array.isArray(result.ledger) ? result.ledger : [];
  const ledgerIds = ledger.map(({ id }) => id).filter(Boolean);
  if (!sameStrings(ledgerIds, ownedClaimIds || [])) issues.push("ledger-does-not-cover-owned-claims");
  for (const item of ledger) {
    if (!["reviewed", "corrected", "merged", "unresolved"].includes(String(item?.status || ""))) {
      issues.push("invalid-ledger-status");
      break;
    }
    if (!String(item?.note || "").trim()) {
      issues.push("missing-ledger-note");
      break;
    }
  }
  if (workerDirty) issues.push("worker-dirty");

  const status = String(result.status || "");
  if (status === "ready") {
    if (!result.commit || result.commit !== workerHead) issues.push("commit-does-not-match-head");
    if (commitCount !== 1) issues.push("worker-must-have-one-commit");
    if (!resume?.review?.current || !resume?.review?.packetCurrent || !resume?.review?.capturedEvidenceCurrent) {
      issues.push("review-not-current");
    }
    if (resume?.review?.claimsSupported !== true || resume?.review?.verdict !== "no_change") {
      issues.push("review-not-accepted");
    }
    if (!resume?.verification?.headVerified) issues.push("worker-head-not-frozen-verified");
  } else if (status === "reviewed") {
    if (result.commit) issues.push("reviewed-result-must-not-have-commit");
    if (commitCount !== 0) issues.push("reviewed-worker-has-commit");
    if (!resume?.review?.current || !resume?.review?.packetCurrent || !resume?.review?.capturedEvidenceCurrent) {
      issues.push("review-not-current");
    }
    if (resume?.review?.claimsSupported !== true || resume?.review?.verdict !== "no_change") {
      issues.push("review-not-accepted");
    }
  } else if (["unresolved", "blocked_overlap", "failed"].includes(status)) {
    return { ready: false, state: status, issues };
  } else {
    issues.push("invalid-result-status");
  }

  return {
    ready: issues.length === 0 && ["ready", "reviewed"].includes(status),
    state: issues.length ? "blocked" : status,
    issues: [...new Set(issues)],
  };
}

export function workerNextAction(worker, { ledgerStatus = null } = {}) {
  const state = String(worker?.machine?.state || "");
  const issues = new Set(worker?.machine?.issues || []);
  const ownedClaimIds = worker?.ownedClaimIds || [];

  if (state === "cleaned") return "none";
  if (state === "integrated") return "cleanup";
  if (worker?.machine?.ready) return "integrate";
  if (
    issues.has("worker-worktree-missing")
    && ownedClaimIds.length === 0
    && ledgerStatus
    && ledgerStatus !== "pending"
  ) {
    return "none";
  }
  if (issues.has("ledger-does-not-cover-owned-claims") && ownedClaimIds.length === 0) {
    return "reconcile-result-ledger";
  }
  if (issues.has("review-not-current") || issues.has("review-not-accepted")) return "run-review";
  if (issues.has("worker-head-not-frozen-verified")) return "verify-head";
  if (issues.size) return "resolve-blocker";
  if (!worker?.result) {
    if (worker?.workerDirty) return "finish-staged-work";
    if (Number(worker?.commitCount) > 0) return "write-result";
    return "investigate";
  }
  return state || "inspect";
}

export function summarizeHarvest(harvest, { ledgerItems = [], externalClaims = [] } = {}) {
  const ledgerById = new Map((ledgerItems || []).map((item) => [item.id, item]));
  const externalClaimOwners = new Map();
  for (const claim of externalClaims) {
    const key = String(claim.label || claim.worktree || "unknown");
    const current = externalClaimOwners.get(key) || {
      label: claim.label || null,
      worktree: claim.worktree || null,
      ids: [],
    };
    current.ids.push(claim.id);
    externalClaimOwners.set(key, current);
  }
  return {
    sessionId: harvest.sessionId,
    baseHead: harvest.baseHead,
    primaryHead: harvest.primaryHead,
    readyCount: harvest.readyCount,
    integratedCount: harvest.integratedCount,
    cleanedCount: harvest.cleanedCount,
    externalClaimCount: externalClaims.length,
    externalClaimOwners: [...externalClaimOwners.values()]
      .map((owner) => ({ label: owner.label, count: owner.ids.length }))
      .sort((left, right) => String(left.label).localeCompare(String(right.label))),
    workers: (harvest.workers || []).map((worker) => {
      const ledgerStatus = ledgerById.get(worker.recordId)?.status || null;
      const nextAction = workerNextAction(worker, { ledgerStatus });
      const closed = nextAction === "none" && ledgerStatus && ledgerStatus !== "pending";
      const summary = {
        slot: worker.slot,
        recordId: worker.recordId,
        date: worker.date,
        state: closed ? "closed" : (worker.machine?.state || "unknown"),
        nextAction,
        ledgerStatus,
      };
      if (closed) return summary;
      summary.title = worker.title;
      if (worker.workerDirty) summary.workerDirty = true;
      if (Number.isFinite(worker.commitCount)) summary.commitCount = worker.commitCount;
      if (worker.ownedClaimIds?.length) summary.ownedClaimIds = worker.ownedClaimIds;
      if (worker.result?.status) summary.resultStatus = worker.result.status;
      if (worker.resume?.review?.current != null) summary.reviewCurrent = worker.resume.review.current;
      if (worker.resume?.review?.verdict) summary.reviewVerdict = worker.resume.review.verdict;
      if (worker.resume?.verification?.headVerified != null) {
        summary.frozenVerified = worker.resume.verification.headVerified;
      }
      if (worker.patchIntegrated) summary.patchIntegrated = true;
      if (worker.machine?.issues?.length) summary.issues = worker.machine.issues;
      return summary;
    }),
  };
}

export function workerResultIsIntegrated({
  result,
  ownedClaimIds,
  patchIntegrated,
  ledgerItems,
}) {
  if (!result || (ownedClaimIds || []).length) return false;
  if (!["ready", "reviewed"].includes(String(result.status || ""))) return false;
  if (result.status === "ready" && !patchIntegrated) return false;
  const expected = Array.isArray(result.ledger) ? result.ledger : [];
  if (!expected.length) return false;
  const byId = new Map((ledgerItems || []).map((item) => [item.id, item]));
  return expected.every((item) => {
    const actual = byId.get(item.id);
    return actual
      && actual.status === item.status
      && String(actual.note || "") === String(item.note || "");
  });
}

function repoInfo(cwd = process.cwd()) {
  const currentRoot = git(cwd, ["rev-parse", "--show-toplevel"]).stdout;
  const worktrees = parseWorktreePorcelain(git(currentRoot, ["worktree", "list", "--porcelain"]).stdout);
  const primary = worktrees.find(({ branch }) => branch === "refs/heads/main") || worktrees[0];
  if (!primary?.path) throw new Error("could not resolve primary worktree");
  return {
    currentRoot,
    primaryRoot: resolve(primary.path),
    primaryHead: git(primary.path, ["rev-parse", "HEAD"]).stdout,
    worktrees,
  };
}

function dateMs(date) {
  const value = Date.parse(String(date || "") + "T00:00:00Z");
  return Number.isFinite(value) ? value : null;
}

export function selectSpacedCandidates(candidates, count, minGapDays = DEFAULT_MIN_GAP_DAYS) {
  const selected = [];
  const gapMs = Math.max(0, Number(minGapDays) || 0) * 86_400_000;
  for (const candidate of candidates || []) {
    if (selected.length >= count) break;
    const candidateMs = dateMs(candidate.date);
    const collides = selected.some((existing) => {
      const existingMs = dateMs(existing.date);
      return candidateMs != null && existingMs != null && Math.abs(candidateMs - existingMs) <= gapMs;
    });
    if (!collides) selected.push(candidate);
  }
  for (const candidate of candidates || []) {
    if (selected.length >= count) break;
    if (!selected.some(({ id }) => id === candidate.id)) selected.push(candidate);
  }
  return selected;
}

export function captureReadinessTier(readiness) {
  const articleCount = Number(readiness?.articleCount || 0);
  const capturedCount = Number(readiness?.capturedCount || 0);
  if (articleCount > 0 && capturedCount >= articleCount) return 2;
  if (capturedCount > 0) return 1;
  return 0;
}

export function prioritizeEvidenceReadyCandidates(candidates, readinessById = new Map()) {
  return (candidates || [])
    .map((candidate, index) => {
      const readiness = readinessById instanceof Map
        ? readinessById.get(candidate.id)
        : readinessById?.[candidate.id];
      return {
        candidate,
        index,
        riskScore: Number(candidate?.riskScore || 0),
        readinessTier: captureReadinessTier(readiness),
      };
    })
    .sort((left, right) => (
      right.riskScore - left.riskScore
      || right.readinessTier - left.readinessTier
      || left.index - right.index
    ))
    .map(({ candidate }) => candidate);
}

function inspectCaptureReadiness(primaryRoot, candidates) {
  const byId = new Map();
  for (const candidate of candidates || []) {
    try {
      const captured = nodeJson(primaryRoot, [
        "research/cli.mjs",
        "audit-captured",
        candidate.id,
      ]);
      byId.set(candidate.id, {
        articleCount: Number(captured.articleCount || 0),
        capturedCount: Number(captured.capturedCount || 0),
        tier: captureReadinessTier(captured),
        error: "",
      });
    } catch (error) {
      byId.set(candidate.id, {
        articleCount: 0,
        capturedCount: 0,
        tier: 0,
        error: String(error?.message || error),
      });
    }
  }
  return byId;
}

export function worktreeCanBePruned({
  isPrimary,
  activeClaim,
  dirty,
  cherryOutput,
  patchIntegrated = null,
}) {
  if (isPrimary || activeClaim || dirty) return false;
  if (patchIntegrated != null) return Boolean(patchIntegrated);
  return String(cherryOutput || "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .every((line) => line.startsWith("-"));
}

function removeSafeWorktree(path) {
  if (!existsSync(path)) return { removed: true, method: "already-missing", error: "" };
  try {
    rmSync(path, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
    return {
      removed: !existsSync(path),
      method: "filesystem-batch",
      error: existsSync(path) ? "directory still exists after recursive removal" : "",
    };
  } catch (error) {
    return {
      removed: false,
      method: "filesystem-batch",
      error: String(error?.message || error),
    };
  }
}

function activeClaims(primaryRoot, worktrees) {
  const claimRoot = join(primaryRoot, ".work", "audit-claims");
  if (!existsSync(claimRoot)) return [];
  const active = new Set(worktrees.map(({ path }) => normalized(path)));
  const claims = [];
  for (const name of readdirSync(claimRoot)) {
    if (!name.endsWith(".json")) continue;
    try {
      const claim = readJson(join(claimRoot, name));
      if (active.has(normalized(claim.worktree))) claims.push(claim);
    } catch {
    }
  }
  return claims;
}

export function externalClaimNextAction({
  ledgerStatuses = [],
  dirty = false,
  unintegratedCommitCount = 0,
  integratedEquivalentCommitCount = 0,
  frozenVerified = false,
} = {}) {
  if (ledgerStatuses.length && ledgerStatuses.every((status) => status && status !== "pending")) {
    return "release-claim";
  }
  if (dirty) return "finish-staged-work";
  if (unintegratedCommitCount > 0) {
    return frozenVerified ? "inspect-review-then-integrate" : "verify-committed-work";
  }
  if (integratedEquivalentCommitCount > 0) return "reconcile-integrated-work";
  return "investigate-or-review";
}

export function summarizeExternalClaimWorktrees(primaryRoot, externalClaims, ledgerItems = []) {
  const ledgerById = new Map((ledgerItems || []).map((item) => [item.id, item]));
  const grouped = new Map();
  for (const claim of externalClaims || []) {
    const key = normalized(claim.worktree);
    const current = grouped.get(key) || {
      label: claim.label || null,
      worktree: claim.worktree,
      ids: [],
    };
    current.ids.push(claim.id);
    grouped.set(key, current);
  }

  return [...grouped.values()]
    .map((group) => {
      const ids = sorted(group.ids);
      const ledgerStatuses = ids.map((id) => ledgerById.get(id)?.status || null);
      if (ledgerStatuses.length && ledgerStatuses.every((status) => status && status !== "pending")) {
        return {
          label: group.label,
          worktree: group.worktree,
          ids,
          ledgerStatuses,
          dirty: null,
          unintegratedCommitCount: null,
          integratedEquivalentCommitCount: null,
          frozenVerified: null,
          nextAction: "release-claim",
          issues: [],
        };
      }
      const status = git(group.worktree, ["status", "--porcelain", "--untracked-files=all"], { allowFailure: true });
      const dirty = !status.ok || Boolean(status.stdout);
      if (dirty) {
        return {
          label: group.label,
          worktree: group.worktree,
          ids,
          ledgerStatuses,
          dirty,
          unintegratedCommitCount: null,
          integratedEquivalentCommitCount: null,
          frozenVerified: null,
          nextAction: "finish-staged-work",
          issues: !status.ok ? ["worker-status-unavailable"] : [],
        };
      }
      const head = git(group.worktree, ["rev-parse", "HEAD"], { allowFailure: true });
      const cherry = head.ok
        ? git(primaryRoot, ["cherry", "main", head.stdout], { allowFailure: true })
        : { ok: false, stdout: "", stderr: "worker head unavailable" };
      const unintegratedCommitCount = cherry.ok
        ? cherry.stdout.split(/\r?\n/u).filter((line) => line.startsWith("+")).length
        : -1;
      const integratedEquivalentCommitCount = cherry.ok
        ? cherry.stdout.split(/\r?\n/u).filter((line) => line.startsWith("-")).length
        : -1;
      const verificationPath = head.ok
        ? join(group.worktree, ".work", "correction-verifications", "by-target", head.stdout + ".json")
        : "";
      let frozenVerified = false;
      if (verificationPath && existsSync(verificationPath)) {
        try {
          const verification = readJson(verificationPath);
          frozenVerified = verification?.ok === true && verification?.targetCommit === head.stdout;
        } catch {
        }
      }
      return {
        label: group.label,
        worktree: group.worktree,
        ids,
        ledgerStatuses,
        dirty,
        unintegratedCommitCount,
        integratedEquivalentCommitCount,
        frozenVerified,
        nextAction: externalClaimNextAction({
          ledgerStatuses,
          dirty,
          unintegratedCommitCount,
          integratedEquivalentCommitCount,
          frozenVerified,
        }),
        issues: [
          ...(!status.ok ? ["worker-status-unavailable"] : []),
          ...(!head.ok ? ["worker-head-unavailable"] : []),
          ...(!cherry.ok ? ["git-cherry-unavailable"] : []),
        ],
      };
    })
    .sort((left, right) => {
      const actionOrder = new Map([
        ["reconcile-integrated-work", 0],
        ["inspect-review-then-integrate", 1],
        ["verify-committed-work", 2],
        ["finish-staged-work", 3],
        ["release-claim", 4],
        ["investigate-or-review", 5],
      ]);
      const actionDelta = (actionOrder.get(left.nextAction) ?? 99) - (actionOrder.get(right.nextAction) ?? 99);
      if (actionDelta) return actionDelta;
      return String(left.label || left.worktree).localeCompare(String(right.label || right.worktree));
    });
}

function sessionManifests(primaryRoot) {
  const root = join(primaryRoot, ".work", "audit-swarm");
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name, "manifest.json"))
    .filter(existsSync)
    .map(readJson);
}

function selectSession(primaryRoot, requestedId = "") {
  const sessions = sessionManifests(primaryRoot)
    .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
  const selected = requestedId
    ? sessions.find(({ sessionId }) => sessionId === requestedId)
    : sessions[0];
  if (!selected) throw new Error(requestedId
    ? "unknown audit swarm session: " + requestedId
    : "no prepared audit swarm session found");
  return selected;
}

function completionReceiptPath(primaryRoot, sessionId, slot) {
  return join(primaryRoot, ".work", "audit-swarm", String(sessionId), "completed", `slot-${slot}.json`);
}

function inspectWorker(primaryRoot, worktrees, claims, ledgerItems, worker, receipt = null) {
  const taskPath = join(worker.worktree, ".work", "AUDIT_SWARM_TASK.json");
  const resultPath = join(worker.worktree, ".work", "AUDIT_SWARM_RESULT.json");
  const task = existsSync(taskPath) ? readJson(taskPath) : null;
  const result = existsSync(resultPath) ? readJson(resultPath) : null;
  const registered = worktrees.some(({ path }) => normalized(path) === normalized(worker.worktree));
  if (!registered || !existsSync(worker.worktree)) {
    if (receipt) {
      return {
        ...worker,
        receipt,
        machine: {
          ready: false,
          state: "cleaned",
          issues: [],
        },
        task,
        result,
      };
    }
    return {
      ...worker,
      machine: {
        ready: false,
        state: "blocked",
        issues: ["worker-worktree-missing"],
      },
      task,
      result,
    };
  }

  const status = git(worker.worktree, ["status", "--porcelain", "--untracked-files=all"], { allowFailure: true });
  const workerHead = git(worker.worktree, ["rev-parse", "HEAD"], { allowFailure: true }).stdout;
  const baseHead = String(task?.baseHead || "");
  const baseAncestor = Boolean(baseHead) && git(worker.worktree, ["merge-base", "--is-ancestor", baseHead, workerHead], {
    allowFailure: true,
  }).ok;
  const countResult = baseAncestor
    ? git(worker.worktree, ["rev-list", "--count", baseHead + ".." + workerHead], { allowFailure: true })
    : { ok: false, stdout: "" };
  const commitCount = countResult.ok ? Number(countResult.stdout || 0) : -1;
  const ownedClaimIds = claims
    .filter(({ worktree: owner }) => normalized(owner) === normalized(worker.worktree))
    .map(({ id }) => id);
  const cherry = result?.status === "ready"
    ? git(primaryRoot, ["cherry", "main", workerHead], { allowFailure: true })
    : { ok: true, stdout: "" };
  const patchIdIntegrated = result?.status === "ready"
    && cherry.ok
    && !cherry.stdout.split(/\r?\n/u).filter(Boolean).some((line) => line.startsWith("+"));
  const contentIntegrated = result?.status === "ready"
    && workerContentIntegrated(primaryRoot, baseHead, workerHead);
  const patchIntegrated = patchIdIntegrated || contentIntegrated;
  const integrated = workerResultIsIntegrated({
    result,
    ownedClaimIds,
    patchIntegrated,
    ledgerItems,
  });
  if (integrated) {
    return {
      ...worker,
      task,
      result,
      workerHead,
      workerDirty: !status.ok || Boolean(status.stdout),
      baseAncestor,
      commitCount,
      ownedClaimIds: [],
      patchIntegrated,
      resume: null,
      resumeError: "",
      machine: {
        ready: false,
        state: "integrated",
        issues: [],
      },
    };
  }
  let resume = null;
  let resumeError = "";
  if (result && task?.record?.id) {
    try {
      resume = nodeJson(worker.worktree, ["research/cli.mjs", "audit-resume", task.record.id]);
    } catch (error) {
      resumeError = String(error?.message || error).split(/\r?\n/u)[0];
    }
  }
  const machine = validateWorkerResult({
    task,
    result,
    workerHead,
    workerDirty: !status.ok || Boolean(status.stdout),
    commitCount,
    ownedClaimIds,
    resume,
  });
  if (!baseAncestor) machine.issues.push("worker-base-not-ancestor");
  if (!status.ok) machine.issues.push("worker-status-unavailable");
  if (resumeError) machine.issues.push("audit-resume-failed");
  machine.issues = [...new Set(machine.issues)];
  machine.ready = machine.ready && machine.issues.length === 0;
  if (machine.issues.length) machine.state = "blocked";

  return {
    ...worker,
    task,
    result,
    workerHead,
    workerDirty: !status.ok || Boolean(status.stdout),
    baseAncestor,
    commitCount,
    ownedClaimIds: sorted(ownedClaimIds),
    patchIntegrated,
    resume,
    resumeError,
    machine,
  };
}

function harvestSession(info, options, {
  claims: providedClaims = null,
  ledgerItems: providedLedgerItems = null,
} = {}) {
  const session = selectSession(info.primaryRoot, String(options.session || ""));
  const claims = providedClaims || activeClaims(info.primaryRoot, info.worktrees);
  const ledgerPath = join(info.primaryRoot, ".work", "audit-ledger.json");
  const ledgerItems = providedLedgerItems
    || (existsSync(ledgerPath) ? readJson(ledgerPath).items || [] : []);
  const workers = (session.workers || []).map((worker) => {
    const receiptPath = completionReceiptPath(info.primaryRoot, session.sessionId, worker.slot);
    const receipt = existsSync(receiptPath) ? readJson(receiptPath) : null;
    return inspectWorker(
      info.primaryRoot,
      info.worktrees,
      claims,
      ledgerItems,
      worker,
      receipt,
    );
  });
  return {
    sessionId: session.sessionId,
    baseHead: session.baseHead,
    primaryHead: info.primaryHead,
    readyCount: workers.filter(({ machine }) => machine?.ready).length,
    integratedCount: workers.filter(({ machine }) => machine?.state === "integrated").length,
    cleanedCount: workers.filter(({ machine }) => machine?.state === "cleaned").length,
    workers,
  };
}

function harvestCommand(options) {
  const info = repoInfo();
  if (normalized(info.currentRoot) !== normalized(info.primaryRoot)) {
    throw new Error("audit swarm harvest must run from the primary worktree");
  }
  process.stdout.write(JSON.stringify(harvestSession(info, options), null, 2) + "\n");
}

function briefCommand(options) {
  const info = repoInfo();
  if (normalized(info.currentRoot) !== normalized(info.primaryRoot)) {
    throw new Error("audit swarm brief must run from the primary worktree");
  }
  const ledgerPath = join(info.primaryRoot, ".work", "audit-ledger.json");
  const ledgerItems = existsSync(ledgerPath) ? readJson(ledgerPath).items || [] : [];
  const timeline = ledgerItems.filter(({ kind }) => kind === "timeline");
  const claims = activeClaims(info.primaryRoot, info.worktrees);
  const harvest = harvestSession(info, options, { claims, ledgerItems });
  const workerPaths = new Set((harvest.workers || []).map(({ worktree }) => normalized(worktree)));
  const externalClaims = claims.filter(({ worktree }) => !workerPaths.has(normalized(worktree)));
  const result = {
    primaryHead: info.primaryHead,
    primaryClean: !git(info.primaryRoot, ["status", "--porcelain", "--untracked-files=all"]).stdout,
    timeline: {
      total: timeline.length,
      pending: timeline.filter(({ status, present }) => status === "pending" && present !== false).length,
      closed: timeline.filter(({ status }) => status !== "pending").length,
    },
    activeClaimCount: claims.length,
    ...summarizeHarvest(harvest, { ledgerItems, externalClaims }),
  };
  if (options["external-actions"] === true) {
    result.externalWorktrees = summarizeExternalClaimWorktrees(info.primaryRoot, externalClaims, ledgerItems);
  }
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

function integrationOverlap(primaryRoot, baseHead, workerHead, claimedIds) {
  const workerFiles = git(primaryRoot, ["diff", "--name-only", baseHead + ".." + workerHead, "--", "data"], {
    allowFailure: true,
  });
  const primaryHead = git(primaryRoot, ["rev-parse", "HEAD"]).stdout;
  if (!workerFiles.ok) {
    return {
      ok: false,
      primaryHead,
      workerChangedIds: [],
      primaryChangedIds: [],
      overlapIds: [],
      error: "could not compare worker and primary data changes",
    };
  }
  const comparedFiles = workerFiles.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((path) => path.endsWith(".jsonl"));
  const workerDiff = comparedFiles.length
    ? git(primaryRoot, ["diff", baseHead + ".." + workerHead, "--", ...comparedFiles], { allowFailure: true })
    : { ok: true, stdout: "" };
  const primaryDiff = comparedFiles.length
    ? git(primaryRoot, ["diff", baseHead + ".." + primaryHead, "--", ...comparedFiles], { allowFailure: true })
    : { ok: true, stdout: "" };
  if (!workerDiff.ok || !primaryDiff.ok) {
    return {
      ok: false,
      primaryHead,
      comparedFiles,
      workerChangedIds: [],
      primaryChangedIds: [],
      overlapIds: [],
      error: "could not compare worker and primary data changes",
    };
  }
  const workerChangedIds = changedJsonlIds(workerDiff.stdout);
  const primaryChangedIds = changedJsonlIds(primaryDiff.stdout);
  const claimed = new Set(claimedIds || []);
  const primaryChanged = new Set(primaryChangedIds);
  const overlapIds = workerChangedIds.filter((id) => primaryChanged.has(id));
  const claimedOverlapIds = overlapIds.filter((id) => claimed.has(id));
  return {
    ok: true,
    primaryHead,
    comparedFiles,
    workerChangedIds,
    primaryChangedIds,
    overlapIds,
    claimedOverlapIds,
    error: "",
  };
}

export function integrationBlockReasons({
  fileCheckOk,
  overlapOk,
  overlapIds = [],
  contentAlreadyIntegrated = false,
}) {
  const blocked = [];
  if (!fileCheckOk) blocked.push("worker-changed-disallowed-files");
  if (!overlapOk) blocked.push("overlap-check-failed");
  if (overlapIds.length && !contentAlreadyIntegrated) {
    blocked.push("claimed-record-changed-on-primary");
  }
  return blocked;
}

function allowedWorkerFiles(primaryRoot, baseHead, workerHead) {
  const result = git(primaryRoot, ["diff", "--name-only", baseHead + ".." + workerHead], { allowFailure: true });
  if (!result.ok) return { ok: false, files: [], invalid: ["git-diff-failed"] };
  const files = result.stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  const invalid = files.filter((path) => !(
    path.startsWith("data/news/")
    || path.startsWith("data/timeline/")
    || /^tests\/.+audit-corrections\.test\.mjs$/u.test(path)
  ));
  return { ok: invalid.length === 0, files, invalid };
}

function gitShowText(cwd, ref, path) {
  const result = git(cwd, ["show", ref + ":" + path], { allowFailure: true });
  return result.ok ? { exists: true, text: result.stdout + "\n" } : { exists: false, text: "" };
}

function normalizedText(text) {
  return String(text || "").replace(/\r\n/gu, "\n");
}

export function workerContentIntegrated(primaryRoot, baseHead, workerHead) {
  const fileCheck = allowedWorkerFiles(primaryRoot, baseHead, workerHead);
  if (!fileCheck.ok || !fileCheck.files.length) return false;
  for (const path of fileCheck.files) {
    if (path.startsWith("data/") && path.endsWith(".jsonl")) {
      const base = gitShowText(primaryRoot, baseHead, path);
      const worker = gitShowText(primaryRoot, workerHead, path);
      if (!worker.exists) return false;
      const primaryPath = resolve(primaryRoot, path);
      const primaryText = existsSync(primaryPath) ? readFileSync(primaryPath, "utf8") : "";
      if (!jsonlWorkerChangesPresent(base.text, worker.text, primaryText).ok) return false;
      continue;
    }
    if (/^tests\/.+audit-corrections\.test\.mjs$/u.test(path)) {
      const worker = gitShowText(primaryRoot, workerHead, path);
      const primaryPath = resolve(primaryRoot, path);
      if (!worker.exists || !existsSync(primaryPath)) return false;
      if (normalizedText(worker.text) !== normalizedText(readFileSync(primaryPath, "utf8"))) return false;
      continue;
    }
    return false;
  }
  return true;
}

export function applySemanticWorkerPatch(primaryRoot, baseHead, workerHead, files) {
  const updates = [];
  for (const path of files) {
    if (path.startsWith("data/") && path.endsWith(".jsonl")) {
      const base = gitShowText(primaryRoot, baseHead, path);
      const worker = gitShowText(primaryRoot, workerHead, path);
      if (!worker.exists) {
        return { ok: false, reason: "worker-jsonl-file-missing", path };
      }
      const primaryPath = resolve(primaryRoot, path);
      const primaryText = existsSync(primaryPath) ? readFileSync(primaryPath, "utf8") : "";
      const merged = mergeJsonlRecordText(base.text, worker.text, primaryText);
      if (!merged.ok) {
        return {
          ok: false,
          reason: "semantic-jsonl-overlap",
          path,
          overlapIds: merged.overlapIds,
        };
      }
      updates.push({ path, target: primaryPath, text: merged.text });
      continue;
    }

    if (/^tests\/.+audit-corrections\.test\.mjs$/u.test(path)) {
      const base = gitShowText(primaryRoot, baseHead, path);
      const worker = gitShowText(primaryRoot, workerHead, path);
      const primaryPath = resolve(primaryRoot, path);
      const primaryExists = existsSync(primaryPath);
      const primaryText = primaryExists ? readFileSync(primaryPath, "utf8") : "";
      if (base.exists !== primaryExists || (base.exists && normalizedText(base.text) !== normalizedText(primaryText))) {
        return { ok: false, reason: "semantic-test-file-overlap", path };
      }
      if (!worker.exists) {
        return { ok: false, reason: "worker-test-file-missing", path };
      }
      updates.push({ path, target: primaryPath, text: worker.text });
      continue;
    }

    return { ok: false, reason: "semantic-disallowed-file", path };
  }

  const touched = updates.map(({ path }) => path);
  for (const update of updates) {
    mkdirSync(dirname(update.target), { recursive: true });
    writeFileSync(update.target, update.text, "utf8");
  }
  const add = git(primaryRoot, ["add", "--", ...touched], { allowFailure: true });
  if (!add.ok) {
    git(primaryRoot, ["reset", "--hard", "HEAD"], { allowFailure: true });
    return { ok: false, reason: "semantic-stage-failed", error: add.stderr || add.stdout };
  }
  const status = git(primaryRoot, ["diff", "--cached", "--name-only"], { allowFailure: true });
  if (!status.ok || !status.stdout.trim()) {
    git(primaryRoot, ["reset", "--hard", "HEAD"], { allowFailure: true });
    return { ok: false, reason: "semantic-no-staged-change" };
  }
  const commit = git(primaryRoot, ["commit", "-C", workerHead], { allowFailure: true });
  if (!commit.ok) {
    git(primaryRoot, ["reset", "--hard", "HEAD"], { allowFailure: true });
    return { ok: false, reason: "semantic-commit-failed", error: commit.stderr || commit.stdout };
  }
  return {
    ok: true,
    integratedHead: git(primaryRoot, ["rev-parse", "HEAD"]).stdout,
    touched,
  };
}

export function manualCommitIntegrationBlockReasons({
  sourceWorktreeFound,
  sourceClean,
  sourceReviewCurrent,
  sourceReviewAccepted,
  sourceFrozenVerified,
  fileCheckOk,
  hasFiles,
  overlapOk,
  overlapIds = [],
  contentAlreadyIntegrated = false,
}) {
  const blocked = [];
  if (!contentAlreadyIntegrated) {
    if (!sourceWorktreeFound) blocked.push("source-worktree-not-found");
    if (!sourceClean) blocked.push("source-worktree-dirty");
    if (!sourceReviewCurrent) blocked.push("source-review-not-current");
    if (!sourceReviewAccepted) blocked.push("source-review-not-accepted");
    if (!sourceFrozenVerified) blocked.push("source-commit-not-frozen-verified");
  }
  if (!fileCheckOk) blocked.push("worker-changed-disallowed-files");
  if (!hasFiles) blocked.push("worker-has-no-allowed-changes");
  if (!overlapOk) blocked.push("overlap-check-failed");
  if (overlapIds.length && !contentAlreadyIntegrated) blocked.push("record-changed-on-primary");
  return blocked;
}

function manualCommitIntegrationPlan(info, options) {
  const requestedCommit = String(options.commit || "").trim();
  const recordId = String(options.record || "").trim();
  if (!requestedCommit) throw new Error("integrate-commit requires --commit <sha>");
  if (!recordId) throw new Error("integrate-commit requires --record <id>");

  const commitResult = git(info.primaryRoot, ["rev-parse", requestedCommit + "^{commit}"], { allowFailure: true });
  if (!commitResult.ok) throw new Error("could not resolve integration commit: " + requestedCommit);
  const workerHead = commitResult.stdout;
  const requestedBase = String(options.base || "").trim();
  const baseResult = git(info.primaryRoot, ["rev-parse", (requestedBase || workerHead + "^") + "^{commit}"], {
    allowFailure: true,
  });
  if (!baseResult.ok) throw new Error("could not resolve integration base");
  const baseHead = baseResult.stdout;

  const source = info.worktrees.find(({ head }) => head === workerHead);
  const sourceRoot = source?.path ? resolve(source.path) : "";
  const sourceStatus = sourceRoot
    ? git(sourceRoot, ["status", "--porcelain", "--untracked-files=all"], { allowFailure: true })
    : { ok: false, stdout: "" };
  let resume = null;
  if (sourceRoot && sourceStatus.ok && !sourceStatus.stdout) {
    try {
      resume = parseJsonText(execFileSync(process.execPath, [
        join(sourceRoot, "research", "cli.mjs"),
        "audit-resume",
        recordId,
      ], {
        cwd: sourceRoot,
        encoding: "utf8",
        windowsHide: true,
      }));
    } catch {
      resume = null;
    }
  }

  const fileCheck = allowedWorkerFiles(info.primaryRoot, baseHead, workerHead);
  const overlap = integrationOverlap(info.primaryRoot, baseHead, workerHead, [recordId]);
  const contentAlreadyIntegrated = fileCheck.ok
    && fileCheck.files.length > 0
    && workerContentIntegrated(info.primaryRoot, baseHead, workerHead);
  const sourceReviewCurrent = Boolean(
    resume?.review?.current
    && resume?.review?.packetCurrent
    && resume?.review?.capturedEvidenceCurrent,
  );
  const sourceReviewAccepted = Boolean(
    resume?.review?.claimsSupported === true
    && resume?.review?.verdict === "no_change",
  );
  const sourceFrozenVerified = Boolean(resume?.verification?.headVerified);
  const blocked = manualCommitIntegrationBlockReasons({
    sourceWorktreeFound: Boolean(sourceRoot),
    sourceClean: Boolean(sourceRoot && sourceStatus.ok && !sourceStatus.stdout),
    sourceReviewCurrent,
    sourceReviewAccepted,
    sourceFrozenVerified,
    fileCheckOk: fileCheck.ok,
    hasFiles: fileCheck.files.length > 0,
    overlapOk: overlap.ok,
    overlapIds: overlap.overlapIds,
    contentAlreadyIntegrated,
  });

  return {
    recordId,
    workerHead,
    baseHead,
    sourceWorktree: sourceRoot || null,
    primaryHead: overlap.primaryHead || info.primaryHead,
    files: fileCheck.files,
    invalidFiles: fileCheck.invalid,
    comparedFiles: overlap.comparedFiles || [],
    workerChangedIds: overlap.workerChangedIds,
    primaryChangedIds: overlap.primaryChangedIds,
    overlapIds: overlap.overlapIds,
    contentAlreadyIntegrated,
    sourceReviewCurrent,
    sourceReviewAccepted,
    sourceFrozenVerified,
    blocked,
    canApply: blocked.length === 0,
  };
}

function integrateCommitCommandUnlocked(options) {
  const info = repoInfo();
  if (normalized(info.currentRoot) !== normalized(info.primaryRoot)) {
    throw new Error("audit swarm integrate-commit must run from the primary worktree");
  }
  if (git(info.primaryRoot, ["status", "--porcelain", "--untracked-files=all"]).stdout) {
    throw new Error("primary worktree must be clean before commit integration");
  }
  const plan = manualCommitIntegrationPlan(info, options);
  if (options.apply !== true || !plan.canApply) {
    process.stdout.write(JSON.stringify({ ...plan, applied: false }, null, 2) + "\n");
    if (options.apply === true && !plan.canApply) process.exitCode = 2;
    return;
  }
  if (plan.contentAlreadyIntegrated) {
    process.stdout.write(JSON.stringify({
      ...plan,
      applied: true,
      integrationMode: "content-already-present",
      integratedHead: git(info.primaryRoot, ["rev-parse", "HEAD"]).stdout,
      verificationRequired: false,
      sourceFrozenVerified: plan.sourceFrozenVerified,
    }, null, 2) + "\n");
    return;
  }

  const before = git(info.primaryRoot, ["rev-parse", "HEAD"]).stdout;
  if (before !== plan.primaryHead) {
    process.stdout.write(JSON.stringify({
      ...plan,
      applied: false,
      reason: "primary-moved-before-apply",
      currentPrimaryHead: before,
    }, null, 2) + "\n");
    process.exitCode = 2;
    return;
  }
  const semantic = applySemanticWorkerPatch(
    info.primaryRoot,
    plan.baseHead,
    plan.workerHead,
    plan.files,
  );
  if (!semantic.ok) {
    process.stdout.write(JSON.stringify({
      ...plan,
      applied: false,
      reason: "semantic-integration-failed",
      semantic,
    }, null, 2) + "\n");
    process.exitCode = 2;
    return;
  }
  const integratedHead = semantic.integratedHead;
  let verification;
  try {
    verification = nodeJson(info.primaryRoot, [
      "research/automation/verify-frozen-correction.mjs",
      "--target",
      integratedHead,
    ]);
  } catch (error) {
    process.stdout.write(JSON.stringify({
      ...plan,
      applied: true,
      integrationMode: "semantic-record-merge",
      before,
      integratedHead,
      verified: false,
      reason: "integrated-frozen-verification-failed",
      error: String(error?.message || error).split(/\r?\n/u)[0],
    }, null, 2) + "\n");
    process.exitCode = 2;
    return;
  }
  const afterVerifyHead = git(info.primaryRoot, ["rev-parse", "HEAD"]).stdout;
  const concurrentDiff = afterVerifyHead === integratedHead
    ? []
    : changedJsonlIds(git(info.primaryRoot, ["diff", integratedHead + ".." + afterVerifyHead, "--", "data"], {
      allowFailure: true,
    }).stdout);
  const workerChanged = new Set(plan.workerChangedIds);
  const concurrentOverlap = concurrentDiff.filter((id) => workerChanged.has(id));
  process.stdout.write(JSON.stringify({
    ...plan,
    applied: true,
    integrationMode: "semantic-record-merge",
    before,
    integratedHead,
    verified: verification?.ok === true,
    verificationTarget: verification?.targetCommit || null,
    concurrentOverlap,
  }, null, 2) + "\n");
  if (verification?.ok !== true || concurrentOverlap.length) process.exitCode = 2;
}

function integrateCommitCommand(options) {
  if (options.apply !== true) return integrateCommitCommandUnlocked(options);
  const info = repoInfo();
  const lock = acquireIntegrationLock(info.primaryRoot);
  if (!lock.ok) {
    process.stdout.write(JSON.stringify({
      applied: false,
      reason: lock.reason,
      lock: { path: lock.lockPath, owner: lock.owner },
    }, null, 2) + "\n");
    process.exitCode = 3;
    return;
  }
  try {
    return integrateCommitCommandUnlocked(options);
  } finally {
    releaseIntegrationLock(lock);
  }
}

function markLedger(primaryRoot, ledgerItems) {
  const marked = [];
  for (const item of ledgerItems || []) {
    marked.push(nodeJson(primaryRoot, [
      "research/cli.mjs",
      "audit-mark",
      item.id,
      item.status,
      String(item.note || ""),
    ]));
  }
  return marked;
}

function integrateCommandUnlocked(options) {
  const info = repoInfo();
  if (normalized(info.currentRoot) !== normalized(info.primaryRoot)) {
    throw new Error("audit swarm integrate must run from the primary worktree");
  }
  if (git(info.primaryRoot, ["status", "--porcelain", "--untracked-files=all"]).stdout) {
    throw new Error("primary worktree must be clean before swarm integration");
  }
  const harvest = harvestSession(info, options);
  const slot = Number(options.slot || 0);
  if (!Number.isInteger(slot) || slot < 1) throw new Error("audit swarm integrate requires --slot <n>");
  const worker = harvest.workers.find((candidate) => Number(candidate.slot) === slot);
  if (!worker) throw new Error("unknown worker slot: " + slot);
  if (!worker.machine?.ready) {
    process.stdout.write(JSON.stringify({
      applied: false,
      reason: "worker-not-ready",
      worker,
    }, null, 2) + "\n");
    process.exitCode = 2;
    return;
  }

  const fileCheck = allowedWorkerFiles(info.primaryRoot, worker.task.baseHead, worker.workerHead);
  const overlap = integrationOverlap(
    info.primaryRoot,
    worker.task.baseHead,
    worker.workerHead,
    worker.ownedClaimIds,
  );
  const contentAlreadyIntegrated = worker.result.status === "ready"
    && workerContentIntegrated(info.primaryRoot, worker.task.baseHead, worker.workerHead);
  const blocked = integrationBlockReasons({
    fileCheckOk: fileCheck.ok,
    overlapOk: overlap.ok,
    overlapIds: overlap.overlapIds,
    contentAlreadyIntegrated,
  });
  const plan = {
    applied: false,
    sessionId: harvest.sessionId,
    slot,
    recordId: worker.recordId,
    workerStatus: worker.result.status,
    workerHead: worker.workerHead,
    primaryHead: overlap.primaryHead,
    changedFiles: fileCheck.files,
    invalidFiles: fileCheck.invalid,
    workerChangedIds: overlap.workerChangedIds,
    primaryChangedIds: overlap.primaryChangedIds,
    overlapIds: overlap.overlapIds,
    claimedOverlapIds: overlap.claimedOverlapIds,
    contentAlreadyIntegrated,
    ledger: worker.result.ledger,
    blocked,
  };
  if (blocked.length || options.apply !== true) {
    process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
    if (blocked.length) process.exitCode = 2;
    return;
  }

  const preApplyHead = git(info.primaryRoot, ["rev-parse", "HEAD"]).stdout;
  if (preApplyHead !== overlap.primaryHead) {
    process.stdout.write(JSON.stringify({
      ...plan,
      applied: false,
      reason: "primary-moved-before-apply",
      currentPrimaryHead: preApplyHead,
    }, null, 2) + "\n");
    process.exitCode = 2;
    return;
  }

  if (worker.result.status === "reviewed") {
    const marked = markLedger(info.primaryRoot, worker.result.ledger);
    process.stdout.write(JSON.stringify({
      ...plan,
      applied: true,
      integrationMode: "reviewed-no-change",
      integratedHead: git(info.primaryRoot, ["rev-parse", "HEAD"]).stdout,
      marked,
    }, null, 2) + "\n");
    return;
  }

  if (contentAlreadyIntegrated) {
    const marked = markLedger(info.primaryRoot, worker.result.ledger);
    process.stdout.write(JSON.stringify({
      ...plan,
      applied: true,
      integrationMode: "content-already-present",
      integratedHead: git(info.primaryRoot, ["rev-parse", "HEAD"]).stdout,
      verified: true,
      verificationTarget: worker.workerHead,
      marked,
    }, null, 2) + "\n");
    return;
  }

  const before = git(info.primaryRoot, ["rev-parse", "HEAD"]).stdout;
  const pick = git(info.primaryRoot, ["cherry-pick", worker.workerHead], { allowFailure: true });
  let integrationMode = "correction";
  let semanticFallback = null;
  if (!pick.ok) {
    git(info.primaryRoot, ["cherry-pick", "--abort"], { allowFailure: true });
    semanticFallback = applySemanticWorkerPatch(
      info.primaryRoot,
      worker.task.baseHead,
      worker.workerHead,
      fileCheck.files,
    );
    if (!semanticFallback.ok) {
      process.stdout.write(JSON.stringify({
        ...plan,
        applied: false,
        reason: "cherry-pick-conflict",
        error: pick.stderr || pick.stdout,
        semanticFallback,
      }, null, 2) + "\n");
      process.exitCode = 2;
      return;
    }
    integrationMode = "semantic-record-merge";
  }
  const integratedHead = git(info.primaryRoot, ["rev-parse", "HEAD"]).stdout;
  let verification;
  try {
    verification = nodeJson(info.primaryRoot, [
      "research/automation/verify-frozen-correction.mjs",
      "--target",
      integratedHead,
    ]);
  } catch (error) {
    process.stdout.write(JSON.stringify({
      ...plan,
      applied: true,
      integrationMode,
      before,
      integratedHead,
      verified: false,
      reason: "integrated-frozen-verification-failed",
      error: String(error?.message || error).split(/\r?\n/u)[0],
    }, null, 2) + "\n");
    process.exitCode = 2;
    return;
  }
  if (verification?.ok !== true) {
    process.stdout.write(JSON.stringify({
      ...plan,
      applied: true,
      integrationMode,
      before,
      integratedHead,
      verified: false,
      verification,
    }, null, 2) + "\n");
    process.exitCode = 2;
    return;
  }

  const afterVerifyHead = git(info.primaryRoot, ["rev-parse", "HEAD"]).stdout;
  const concurrentDiff = afterVerifyHead === integratedHead
    ? []
    : changedJsonlIds(git(info.primaryRoot, ["diff", integratedHead + ".." + afterVerifyHead, "--", "data"], {
      allowFailure: true,
    }).stdout);
  const workerChanged = new Set(overlap.workerChangedIds);
  const concurrentOverlap = concurrentDiff.filter((id) => workerChanged.has(id));
  if (concurrentOverlap.length) {
    process.stdout.write(JSON.stringify({
      ...plan,
      applied: true,
      integrationMode,
      before,
      integratedHead,
      verified: true,
      verification,
      marked: [],
      reason: "claimed-record-changed-after-integration",
      concurrentOverlap,
    }, null, 2) + "\n");
    process.exitCode = 2;
    return;
  }

  const marked = markLedger(info.primaryRoot, worker.result.ledger);
  process.stdout.write(JSON.stringify({
    ...plan,
    applied: true,
    integrationMode,
    before,
    integratedHead,
    verified: true,
    verificationTarget: verification.targetCommit,
    semanticFallback,
    marked,
  }, null, 2) + "\n");
}

function integrateCommand(options) {
  if (options.apply !== true) return integrateCommandUnlocked(options);
  const info = repoInfo();
  const lock = acquireIntegrationLock(info.primaryRoot);
  if (!lock.ok) {
    process.stdout.write(JSON.stringify({
      applied: false,
      reason: lock.reason,
      lock: {
        path: lock.lockPath,
        owner: lock.owner,
      },
    }, null, 2) + "\n");
    process.exitCode = 3;
    return;
  }
  try {
    return integrateCommandUnlocked(options);
  } finally {
    releaseIntegrationLock(lock);
  }
}

function newSessionId() {
  return new Date().toISOString().replace(/[-:.]/gu, "");
}

function taskMarkdown(candidate, baseHead, worktree) {
  return [
    "# Audit swarm task",
    "",
    "Record: " + candidate.id,
    "Date: " + candidate.date,
    "Title: " + candidate.title,
    "Risk signals: " + ((candidate.signals || []).join(", ") || "none"),
    "Base primary commit: " + baseHead,
    "Worktree: " + worktree,
    "",
    "Read AGENTS.md and research/audit-swarm/WORKER.md before changing anything.",
    "",
    "Start with:",
    "",
    "    node research/cli.mjs audit-resume " + candidate.id,
    "    node research/cli.mjs audit-prepare " + candidate.id + " 3 8 --retry-missing",
    "",
    "Do not integrate into primary and do not run research finish.",
    "If a duplicate or conflated neighbor must be edited or removed, reserve the whole cluster first:",
    "",
    "    node research/cli.mjs audit-claim " + candidate.id + " <related-id> [more-related-ids...]",
    "",
    "Finish by writing .work/AUDIT_SWARM_RESULT.json as described in research/audit-swarm/WORKER.md.",
    "",
  ].join("\n");
}

function statusCommand() {
  const info = repoInfo();
  const ledgerPath = join(info.primaryRoot, ".work", "audit-ledger.json");
  const ledger = existsSync(ledgerPath) ? readJson(ledgerPath) : { items: [] };
  const timeline = (ledger.items || []).filter(({ kind }) => kind === "timeline");
  const claims = activeClaims(info.primaryRoot, info.worktrees);
  process.stdout.write(JSON.stringify({
    primaryRoot: info.primaryRoot,
    primaryHead: info.primaryHead,
    primaryClean: !git(info.primaryRoot, ["status", "--porcelain", "--untracked-files=all"]).stdout,
    timeline: {
      total: timeline.length,
      pending: timeline.filter(({ status, present }) => status === "pending" && present !== false).length,
      closed: timeline.filter(({ status }) => status !== "pending").length,
    },
    activeClaimCount: claims.length,
    activeClaims: claims,
    sessions: sessionManifests(info.primaryRoot),
  }, null, 2) + "\n");
}

function prepareCommand(options) {
  const info = repoInfo();
  if (normalized(info.currentRoot) !== normalized(info.primaryRoot)) {
    throw new Error("audit swarm prepare must run from the primary worktree");
  }
  if (git(info.primaryRoot, ["status", "--porcelain", "--untracked-files=all"]).stdout) {
    throw new Error("primary worktree must be clean before preparing an audit swarm batch");
  }

  const workers = Math.max(1, Math.min(MAX_WORKERS, Number(options.workers) || DEFAULT_WORKERS));
  const scanLimit = Math.max(workers * 4, Number(options["scan-limit"]) || DEFAULT_SCAN_LIMIT);
  const minGapDays = Math.max(0, Number(options["min-gap-days"]) || DEFAULT_MIN_GAP_DAYS);
  const pick = nodeJson(info.primaryRoot, [
    "research/cli.mjs",
    "audit-pick",
    String(Math.min(50, workers * 10)),
    String(scanLimit),
  ]);
  const captureReadiness = inspectCaptureReadiness(info.primaryRoot, pick.candidates);
  const rankedCandidates = prioritizeEvidenceReadyCandidates(pick.candidates, captureReadiness);
  const chosen = selectSpacedCandidates(rankedCandidates, workers, minGapDays);
  if (!chosen.length) throw new Error("no unclaimed audit candidates are available");

  const id = String(options.session || newSessionId());
  const sessionRoot = join(info.primaryRoot, ".work", "audit-swarm", id);
  if (existsSync(sessionRoot)) throw new Error("audit swarm session already exists: " + id);
  mkdirSync(sessionRoot, { recursive: true });

  const prepared = [];
  try {
    for (let index = 0; index < chosen.length; index += 1) {
      const candidate = chosen[index];
      const worktree = join(sessionRoot, "worker-" + (index + 1) + "-" + candidate.id.slice(0, 8));
      git(info.primaryRoot, ["worktree", "add", "--detach", worktree, info.primaryHead]);
      try {
        nodeJson(worktree, ["research/cli.mjs", "audit-claim", candidate.id]);
        const localWork = join(worktree, ".work");
        mkdirSync(localWork, { recursive: true });
        writeJson(join(localWork, "AUDIT_SWARM_TASK.json"), {
          schemaVersion: 1,
          sessionId: id,
          slot: index + 1,
          baseHead: info.primaryHead,
          record: candidate,
        });
        writeFileSync(join(localWork, "AUDIT_SWARM_TASK.md"), taskMarkdown(candidate, info.primaryHead, worktree), "utf8");
        prepared.push({
          slot: index + 1,
          recordId: candidate.id,
          date: candidate.date,
          title: candidate.title,
          riskScore: candidate.riskScore,
          signals: candidate.signals,
          evidenceReadiness: captureReadiness.get(candidate.id) || null,
          worktree,
        });
      } catch (error) {
        git(info.primaryRoot, ["worktree", "remove", "--force", worktree], { allowFailure: true });
        throw error;
      }
    }
  } catch (error) {
    for (const worker of prepared) {
      git(info.primaryRoot, ["worktree", "remove", "--force", worker.worktree], { allowFailure: true });
    }
    throw error;
  }

  const manifest = {
    schemaVersion: 1,
    sessionId: id,
    createdAt: Date.now(),
    baseHead: info.primaryHead,
    workers: prepared,
  };
  const manifestPath = join(sessionRoot, "manifest.json");
  writeJson(manifestPath, manifest);
  process.stdout.write(JSON.stringify({
    ...manifest,
    manifestPath,
    operatorPrompt: join(info.primaryRoot, "research", "audit-swarm", "ANTIGRAVITY_PROMPT.md"),
  }, null, 2) + "\n");
}

function cleanupCommand(options) {
  const info = repoInfo();
  if (normalized(info.currentRoot) !== normalized(info.primaryRoot)) {
    throw new Error("audit swarm cleanup must run from the primary worktree");
  }
  const apply = options.apply === true;
  const allSafe = options["all-safe"] === true;
  const claims = activeClaims(info.primaryRoot, info.worktrees);
  const claimOwners = new Set(claims.map(({ worktree }) => normalized(worktree)));
  const ledgerPath = join(info.primaryRoot, ".work", "audit-ledger.json");
  const ledgerItems = existsSync(ledgerPath) ? readJson(ledgerPath).items || [] : [];
  const swarmRoot = normalized(join(info.primaryRoot, ".work", "audit-swarm"));
  const rows = [];

  for (const worktree of info.worktrees) {
    const path = resolve(worktree.path);
    const isPrimary = normalized(path) === normalized(info.primaryRoot);
    const inSwarm = normalized(path).startsWith(swarmRoot + "/");
    if (!allSafe && !inSwarm) continue;
    if (isPrimary || !existsSync(path)) continue;

    const activeClaim = claimOwners.has(normalized(path));
    const status = git(path, ["status", "--porcelain", "--untracked-files=all"], { allowFailure: true });
    if (!status.ok) {
      rows.push({
        path,
        head: worktree.head,
        activeClaim,
        dirty: null,
        patchIntegrated: null,
        safeToPrune: false,
        brokenRegistration: true,
        error: status.stderr || status.stdout || "git status unavailable",
        removal: null,
      });
      continue;
    }
    const dirty = Boolean(status.stdout);
    const cherry = git(info.primaryRoot, ["cherry", "main", worktree.head], { allowFailure: true });
    const taskPath = join(path, ".work", "AUDIT_SWARM_TASK.json");
    const resultPath = join(path, ".work", "AUDIT_SWARM_RESULT.json");
    const task = existsSync(taskPath) ? readJson(taskPath) : null;
    const result = existsSync(resultPath) ? readJson(resultPath) : null;
    const patchIdIntegrated = cherry.ok
      && !cherry.stdout.split(/\r?\n/u).filter(Boolean).some((line) => line.startsWith("+"));
    const contentIntegrated = Boolean(
      task?.baseHead
      && result?.status === "ready"
      && workerContentIntegrated(info.primaryRoot, task.baseHead, worktree.head),
    );
    const patchIntegrated = patchIdIntegrated || contentIntegrated;
    const safe = worktreeCanBePruned({
      isPrimary,
      activeClaim,
      dirty,
      cherryOutput: cherry.stdout,
      patchIntegrated,
    });
    const row = {
      path,
      head: worktree.head,
      activeClaim,
      dirty,
      patchIntegrated,
      integrationEvidence: contentIntegrated ? "record-content" : patchIdIntegrated ? "patch-id" : "",
      safeToPrune: safe,
      brokenRegistration: false,
      error: cherry.ok ? "" : cherry.stderr || cherry.stdout || "git cherry unavailable",
      removal: null,
    };
    rows.push(row);
  }

  if (apply) {
    for (const row of rows.filter(({ safeToPrune }) => safeToPrune)) {
      let receipt = null;
      const taskPath = join(row.path, ".work", "AUDIT_SWARM_TASK.json");
      const resultPath = join(row.path, ".work", "AUDIT_SWARM_RESULT.json");
      if (existsSync(taskPath) && existsSync(resultPath)) {
        const task = readJson(taskPath);
        const result = readJson(resultPath);
        if (workerResultIsIntegrated({
          result,
          ownedClaimIds: [],
          patchIntegrated: row.patchIntegrated,
          ledgerItems,
        })) {
          receipt = {
            schemaVersion: 1,
            sessionId: task.sessionId,
            slot: task.slot,
            recordId: task.record?.id || result.recordId,
            workerHead: row.head,
            result,
            cleanedAt: Date.now(),
          };
        }
      }
      row.removal = removeSafeWorktree(row.path);
      if (row.removal?.removed && receipt) {
        const path = completionReceiptPath(info.primaryRoot, receipt.sessionId, receipt.slot);
        writeJson(path, receipt);
        row.completionReceipt = path;
      }
    }
    git(info.primaryRoot, ["worktree", "prune"]);
    const refreshed = parseWorktreePorcelain(git(info.primaryRoot, ["worktree", "list", "--porcelain"]).stdout);
    loadAuditClaims(join(info.primaryRoot, ".work", "audit-claims"), refreshed.map(({ path }) => path));
  }

  process.stdout.write(JSON.stringify({
    apply,
    allSafe,
    safeCount: rows.filter(({ safeToPrune }) => safeToPrune).length,
    blockedCount: rows.filter(({ safeToPrune }) => !safeToPrune).length,
    removedCount: rows.filter(({ removal }) => removal?.removed).length,
    removalFailureCount: rows.filter(({ removal }) => removal && !removal.removed).length,
    worktrees: rows,
  }, null, 2) + "\n");
}

function help() {
  process.stdout.write([
    "Audit swarm coordinator. It prepares worktrees and claims; it does not launch or publish agents.",
    "",
    "node research/automation/audit-swarm.mjs status",
    "node research/automation/audit-swarm.mjs prepare --workers 4 [--scan-limit 120] [--min-gap-days 3]",
    "  prepare prefers candidates with already captured evidence within each risk tier before creating worktrees.",
    "node research/automation/audit-swarm.mjs harvest [--session <id>]",
    "node research/automation/audit-swarm.mjs brief [--session <id>] [--external-actions]",
    "  brief prints coordinator-only worker state and the next safe action without verbose task/review payloads.",
    "  --external-actions adds a lightweight next-action summary for manual/external claimed worktrees.",
    "node research/automation/audit-swarm.mjs integrate --slot <n> [--session <id>] [--apply]",
    "node research/automation/audit-swarm.mjs integrate-commit --commit <sha> --record <id> [--base <sha>] [--apply]",
    "  integrate-commit uses record-aware JSONL merging for a reviewed, frozen-verified manual worktree commit.",
    "  It verifies the integrated commit but does not mark the audit ledger.",
    "node research/automation/audit-swarm.mjs cleanup [--all-safe] [--apply]",
    "",
    "integrate, integrate-commit, and cleanup are preview-only unless --apply is present.",
  ].join("\n") + "\n");
}

async function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));
  const command = positional[0] || "status";
  if (command === "status") statusCommand();
  else if (command === "prepare") prepareCommand(options);
  else if (command === "harvest") harvestCommand(options);
  else if (command === "brief") briefCommand(options);
  else if (command === "integrate") integrateCommand(options);
  else if (command === "integrate-commit") integrateCommitCommand(options);
  else if (command === "cleanup") cleanupCommand(options);
  else if (command === "help" || command === "--help" || command === "-h") help();
  else throw new Error("unknown audit swarm command: " + command);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((error) => {
    console.error(error?.stack || error);
    process.exit(1);
  });
}
