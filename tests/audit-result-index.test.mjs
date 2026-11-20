import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  auditReviewIndexPath,
  auditReviewRoot,
  reviewPacketIsCurrent,
  sha256Text,
} from "../research/lib/audit-result-index.mjs";

test("Node and PowerShell find the same audit results in an XDG state directory", () => {
  const env = { ...process.env, BORDERCLASH_AUDIT_REVIEW_ROOT: "", LOCALAPPDATA: "", XDG_STATE_HOME: resolve(".work", "test-state-root") };
  const result = spawnSync(process.platform === "win32" ? "powershell.exe" : "pwsh", [
    "-NoProfile", "-Command",
    '. ./research/automation/platform.ps1; Write-Output $script:ResearchLocalRoot',
  ], { env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(auditReviewRoot(env), join(result.stdout.trim(), "audit-reviews"));
});

test("audit review index uses one stable filename per record", () => {
  const root = resolve(".work", "test-review-root");
  assert.equal(
    auditReviewIndexPath("current/summary", { root }),
    join(root, "latest-by-record", "current%2Fsummary.json"),
  );
});

test("review packet freshness is content-addressed", () => {
  const packet = "{\"id\":\"timeline-1\"}\n";
  const index = { packetSha256: sha256Text(packet) };
  assert.equal(reviewPacketIsCurrent(index, packet), true);
  assert.equal(reviewPacketIsCurrent(index, `${packet} `), false);
});
