import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { classifyAuditTriage, mapWithConcurrency } from "../lib/audit-triage.mjs";

const execFileAsync = promisify(execFile);
const root = resolve(process.cwd());
const limit = Math.max(1, Math.min(20, Number(process.argv[2]) || 6));
const scanLimit = Math.max(limit, Math.min(240, Number(process.argv[3]) || Math.max(100, limit * 12)));
const attempts = Math.max(1, Math.min(4, Number(process.argv[4]) || 2));
const concurrency = Math.max(1, Math.min(3, Number(process.argv[5]) || 2));
const startedAt = Date.now();

async function cliJson(args) {
  const { stdout } = await execFileAsync(process.execPath, [resolve(root, "research", "cli.mjs"), ...args], {
    cwd: root,
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    encoding: "utf8",
  });
  return JSON.parse(stdout);
}

const picked = await cliJson(["audit-pick", String(limit), String(scanLimit)]);
const candidates = picked.candidates || [];
const triaged = await mapWithConcurrency(candidates, concurrency, async (candidate) => {
  const rowStartedAt = Date.now();
  try {
    const recovery = await cliJson([
      "audit-recover",
      candidate.id,
      "7",
      "8",
      String(attempts),
    ]);
    return {
      ...classifyAuditTriage(candidate, recovery),
      elapsedMs: Date.now() - rowStartedAt,
    };
  } catch (error) {
    return {
      id: candidate.id,
      date: candidate.date,
      title: candidate.title,
      disposition: "error",
      error: String(error?.stderr || error?.message || error).trim().split(/\r?\n/u)[0],
      elapsedMs: Date.now() - rowStartedAt,
    };
  }
});

process.stdout.write(`${JSON.stringify({
  reviewOnly: true,
  primaryHead: picked.primaryHead,
  pendingTimelineCount: picked.pendingTimelineCount,
  selectedCount: candidates.length,
  claimedCount: picked.claimed?.length || 0,
  scanLimit,
  attempts,
  concurrency,
  elapsedMs: Date.now() - startedAt,
  triaged,
}, null, 2)}\n`);
