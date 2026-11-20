import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export function sha256Text(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

export function auditReviewRoot(env = process.env) {
  const configured = String(env.BORDERCLASH_AUDIT_REVIEW_ROOT || "").trim();
  if (configured) return resolve(configured);

  const localAppData = String(env.LOCALAPPDATA || "").trim();
  if (localAppData) return join(localAppData, "BorderClash", "audit-reviews");

  const xdgStateHome = String(env.XDG_STATE_HOME || "").trim();
  if (xdgStateHome) return join(xdgStateHome, "borderclash", "audit-reviews");

  const home = String(env.HOME || env.USERPROFILE || "").trim();
  if (home) return join(home, ".local", "state", "borderclash", "audit-reviews");

  return resolve(".work", "audit-reviews");
}

export function auditReviewIndexPath(recordId, options = {}) {
  if (!recordId) throw new Error("audit review index requires a record id");
  const root = options.root ? resolve(options.root) : auditReviewRoot(options.env);
  return join(root, "latest-by-record", `${encodeURIComponent(recordId)}.json`);
}

export function loadAuditReviewIndex(recordId, options = {}) {
  const path = auditReviewIndexPath(recordId, options);
  if (!existsSync(path)) return { found: false, path, index: null };
  const index = JSON.parse(readFileSync(path, "utf8"));
  if (String(index?.recordId || "") !== String(recordId)) {
    throw new Error(`audit review index record mismatch: ${path}`);
  }
  return { found: true, path, index };
}

export function reviewPacketIsCurrent(index, packetText) {
  const expected = String(index?.packetSha256 || "").trim().toLowerCase();
  return Boolean(expected) && expected === sha256Text(packetText);
}
