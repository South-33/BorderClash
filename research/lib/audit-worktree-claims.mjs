import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";

function normalizedPath(path) {
  return String(path || "").replaceAll("\\", "/").replace(/\/$/u, "").toLowerCase();
}

function assertClaimId(id) {
  if (!/^[a-z0-9_-]+$/iu.test(String(id || ""))) {
    throw new Error(`invalid audit claim id: ${id}`);
  }
}

function claimFilePath(claimRoot, id) {
  assertClaimId(id);
  return join(claimRoot, `${id}.json`);
}

function readClaim(path, id) {
  try {
    const claim = JSON.parse(readFileSync(path, "utf8"));
    if (claim?.id !== id) throw new Error("claim id mismatch");
    return claim;
  } catch {
    return {
      id,
      worktree: "",
      label: "claim-in-progress",
      claimedAt: null,
    };
  }
}

export function createAuditClaim(claimRoot, { id, worktree, claimedAt = Date.now() }) {
  const path = claimFilePath(claimRoot, id);
  mkdirSync(claimRoot, { recursive: true });
  const claim = {
    id,
    worktree,
    label: basename(String(worktree || "")) || String(worktree || ""),
    claimedAt,
  };
  let fd;
  try {
    fd = openSync(path, "wx");
    writeFileSync(fd, `${JSON.stringify(claim, null, 2)}\n`, "utf8");
    return { created: true, owned: true, claim };
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const existing = readClaim(path, id);
    return {
      created: false,
      owned: normalizedPath(existing.worktree) === normalizedPath(worktree),
      claim: existing,
    };
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export function createAuditClaims(claimRoot, { ids, worktree, claimedAt = Date.now() }) {
  const uniqueIds = [...new Set((ids || []).map((id) => String(id || "").trim()).filter(Boolean))].sort();
  if (!uniqueIds.length) throw new Error("at least one audit claim id is required");

  const acquired = [];
  const owned = [];
  for (const id of uniqueIds) {
    const result = createAuditClaim(claimRoot, { id, worktree, claimedAt });
    if (!result.owned) {
      for (const created of acquired) {
        releaseAuditClaim(claimRoot, created.id, worktree);
      }
      return {
        owned: false,
        conflict: result.claim,
        claims: owned,
      };
    }
    owned.push(result.claim);
    if (result.created) acquired.push(result.claim);
  }
  return {
    owned: true,
    conflict: null,
    claims: owned,
  };
}

export function releaseAuditClaim(claimRoot, id, worktree, { force = false } = {}) {
  const path = claimFilePath(claimRoot, id);
  if (!existsSync(path)) return { released: false, claim: null };
  const claim = readClaim(path, id);
  if (!force && normalizedPath(claim.worktree) !== normalizedPath(worktree)) {
    throw new Error(`audit claim ${id} belongs to ${claim.worktree || claim.label}`);
  }
  unlinkSync(path);
  return { released: true, claim };
}

export function loadAuditClaims(claimRoot, worktreePaths) {
  if (!existsSync(claimRoot)) return { claims: [], staleRemoved: [] };
  const active = new Set((worktreePaths || []).map(normalizedPath));
  const claims = [];
  const staleRemoved = [];
  for (const name of readdirSync(claimRoot)) {
    if (!name.endsWith(".json")) continue;
    const id = name.slice(0, -".json".length);
    if (!/^[a-z0-9_-]+$/iu.test(id)) continue;
    const path = join(claimRoot, name);
    const claim = readClaim(path, id);
    const owner = normalizedPath(claim.worktree);
    if (owner && !active.has(owner)) {
      unlinkSync(path);
      staleRemoved.push(claim);
      continue;
    }
    claims.push(claim);
  }
  return { claims, staleRemoved };
}

export function parseWorktreePorcelain(text) {
  return String(text || "")
    .split(/\r?\n\r?\n/u)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\r?\n/u);
      const field = (prefix) => (lines.find((line) => line.startsWith(prefix)) || "").slice(prefix.length);
      return {
        path: field("worktree "),
        head: field("HEAD "),
        branch: field("branch "),
        detached: lines.includes("detached"),
      };
    })
    .filter((entry) => entry.path && entry.head);
}

export function shouldScanAuditWorktree(path, primaryPath) {
  const normalized = normalizedPath(path);
  const primary = normalizedPath(primaryPath);
  if (!normalized || normalized === primary) return false;
  if (normalized.includes("/.work/fv/")) return false;
  if (normalized.endsWith("/borderclashschemavalidation")) return false;
  return true;
}

export function auditWorktreeNeedsConflictScan({ head, primaryAncestorHeads, timelineDirty }) {
  if (!head) return true;
  if (!primaryAncestorHeads?.has(head)) return true;
  return Boolean(timelineDirty);
}

export function auditWorktreeTimelineStatus(worktreePath, readStatus) {
  try {
    return {
      ok: true,
      timelineDirty: Boolean(String(readStatus(worktreePath) || "").trim()),
      error: "",
    };
  } catch (error) {
    return {
      ok: false,
      timelineDirty: false,
      error: String(error?.message || error).split(/\r?\n/u)[0],
    };
  }
}

export function claimsFromTimelineDiff(candidates, diffText, worktreePath) {
  const diff = String(diffText || "");
  const label = basename(String(worktreePath || "")) || String(worktreePath || "");
  const claims = [];
  for (const candidate of candidates || []) {
    const needle = `\"id\":\"${candidate.id}\"`;
    if (diff.includes(needle)) {
      claims.push({
        id: candidate.id,
        worktree: worktreePath,
        label,
      });
    }
  }
  return claims;
}

export function pickUnclaimedCandidates(candidates, claims, limit = 10) {
  const claimedById = new Map();
  for (const claim of claims || []) {
    if (!claimedById.has(claim.id)) claimedById.set(claim.id, []);
    const list = claimedById.get(claim.id);
    if (!list.some((item) => item.worktree === claim.worktree)) list.push(claim);
  }

  const max = Math.max(1, Number(limit) || 10);
  const selected = [];
  const claimed = [];
  for (const candidate of candidates || []) {
    const owners = claimedById.get(candidate.id) || [];
    if (owners.length) {
      claimed.push({
        id: candidate.id,
        date: candidate.date,
        title: candidate.title,
        riskScore: candidate.riskScore,
        worktrees: owners.map(({ label, worktree }) => ({ label, path: worktree })),
      });
      continue;
    }
    if (selected.length < max) selected.push(candidate);
  }

  return { selected, claimed };
}
