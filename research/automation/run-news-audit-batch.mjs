import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAuditCapturedEvidence } from "../lib/audit-captured-evidence.mjs";
import { loadAuditPacketFromWorktree } from "../lib/audit-packet-loader.mjs";
import { auditReviewPrecheck } from "../lib/audit-review-precheck.mjs";
import {
  auditReviewIndexPath,
  auditReviewRoot,
  sha256Text,
} from "../lib/audit-result-index.mjs";
import {
  assertBatchPromptSize,
  buildBatchReviewPrompt,
  buildBatchReviewSchema,
  normalizeBatchRecordIds,
  validateBatchReviewOutput,
} from "../lib/audit-review-batch.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");
const utf8 = "utf8";

function git(args) {
  const result = spawnSync("git", ["-C", repoRoot, ...args], { encoding: utf8, windowsHide: true });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || "git failed").trim());
  return String(result.stdout || "").trim();
}

function pathWithin(parent, child) {
  const normalizedParent = resolve(parent).replace(/[\\/]+$/u, "").toLowerCase();
  const normalizedChild = resolve(child).replace(/[\\/]+$/u, "").toLowerCase();
  return normalizedChild === normalizedParent || normalizedChild.startsWith(`${normalizedParent}\\`) || normalizedChild.startsWith(`${normalizedParent}/`);
}

function supervisorPath() {
  return join(scriptDir, "agy-supervisor.mjs");
}

function agyPath() {
  const local = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "agy", "bin", "agy.exe") : "";
  return local && existsSync(local) ? local : "agy";
}

async function capturedForPacket(packet) {
  const capturedPacket = { ...packet, evidence: { ...packet.evidence, articles: [packet.record] } };
  return buildAuditCapturedEvidence(capturedPacket);
}

async function loadEntry(recordId, { precheck = true } = {}) {
  const packet = await loadAuditPacketFromWorktree(recordId, { cwd: repoRoot, dataRoot: join(repoRoot, "data") });
  if (packet.kind !== "news") throw new Error(`news batch reviewer only accepts news records: ${recordId}`);
  const captured = await capturedForPacket(packet);
  if (precheck) {
    const result = auditReviewPrecheck(packet, captured);
    if (!result.ok) {
      throw new Error(`audit-review precheck rejected ${recordId}: ${JSON.stringify(result.blockers)}`);
    }
  }
  const packetText = `${JSON.stringify(packet, null, 2)}\n`;
  const capturedText = `${JSON.stringify(captured, null, 2)}\n`;
  return {
    recordId,
    packetText,
    capturedText,
    packetSha256: sha256Text(packetText),
    capturedEvidenceSha256: sha256Text(capturedText),
  };
}

function sawDisallowedTool(eventsText) {
  for (const line of eventsText.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event?.event === "step_update" && event?.step_update?.step_type === "tool") return event.step_update.tool_name || "unknown";
    } catch {
      // Ignore partial/non-JSON event lines.
    }
  }
  return "";
}

function sawFinishedReview(eventsText) {
  return eventsText.split(/\r?\n/u).some((line) => {
    try {
      const event = JSON.parse(line);
      return event?.event === "step_update"
        && event?.step_update?.step_type === "finish"
        && event?.step_update?.state === "DONE";
    } catch {
      return false;
    }
  });
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, utf8);
}

async function main() {
  const startedAt = Date.now();
  const ids = normalizeBatchRecordIds(process.argv.slice(2));
  const reviewRoot = auditReviewRoot();
  if (pathWithin(repoRoot, reviewRoot)) throw new Error("audit-review result index must stay outside the repository");

  const entries = [];
  for (const id of ids) entries.push(await loadEntry(id));
  const repoHead = git(["rev-parse", "HEAD"]);
  const sessionId = new Date().toISOString().replace(/[-:.]/gu, "").replace("Z", "Z");
  const root = join(reviewRoot, `batch-${sessionId}`);
  const workspace = join(root, "workspace");
  const runner = join(root, "runner");
  await mkdir(workspace, { recursive: true });
  await mkdir(runner, { recursive: true });
  if (pathWithin(repoRoot, root)) throw new Error("audit-review work root must stay outside the repository");

  const guide = await readFile(join(repoRoot, "research", "CYCLE_GUIDE.md"), utf8);
  const prompt = buildBatchReviewPrompt({ guide, entries });
  assertBatchPromptSize(prompt);
  const promptPath = join(runner, "prompt.txt");
  const continuationPath = join(runner, "continuation.txt");
  const resultPath = join(runner, "agy-result.json");
  const eventsPath = join(runner, "events.ndjson");
  const stderrPath = join(runner, "stderr.log");
  const sessionPath = join(runner, "session.json");
  const settingsPath = join(runner, "settings.json");
  const schemaPath = join(runner, "result.schema.json");
  const batchInputPath = join(runner, "BATCH_INPUT.json");
  const batchReviewPath = join(runner, "AUDIT_REVIEW_BATCH.json");

  for (const entry of entries) {
    const safeId = encodeURIComponent(entry.recordId);
    await writeFile(join(runner, `AUDIT_PACKET.${safeId}.json`), entry.packetText, utf8);
    await writeFile(join(runner, `CAPTURED_EVIDENCE.${safeId}.json`), entry.capturedText, utf8);
  }
  await writeJson(batchInputPath, entries.map((entry) => ({
    recordId: entry.recordId,
    packetSha256: entry.packetSha256,
    capturedEvidenceSha256: entry.capturedEvidenceSha256,
  })));
  await writeFile(promptPath, prompt, utf8);
  await writeFile(continuationPath, "Continue the same batch audit using only evidence already supplied. Do not use tools. Return the schema-required batch assessment.\n", utf8);
  await writeJson(settingsPath, {
    permissions: {
      deny: [
        "command(*)",
        "read_file(*)",
        "write_file(*)",
        "read_url(*)",
        "execute_url(*)",
        "download_url(*)",
        "mcp(*)",
      ],
    },
  });
  await writeJson(schemaPath, buildBatchReviewSchema(ids));

  const supervisor = spawnSync(process.execPath, [
    supervisorPath(),
    "--agy", agyPath(),
    "--cwd", workspace,
    "--model", "gemini-3.8-flash-medium",
    "--settings-file", settingsPath,
    "--prompt-file", promptPath,
    "--continuation-prompt-file", continuationPath,
    "--result-file", resultPath,
    "--events-file", eventsPath,
    "--stderr-file", stderrPath,
    "--session-file", sessionPath,
    "--agy-log-base", join(runner, "agy"),
    "--json-schema-file", schemaPath,
    "--timeout-minutes", "10",
    "--stuck-minutes", "15",
    "--retry-delay-ms", "30000",
  ], { cwd: repoRoot, stdio: "inherit", windowsHide: true });
  if (supervisor.status !== 0) throw new Error("AGY supervisor failed for news audit batch");

  const eventsText = await readFile(eventsPath, utf8);
  const toolName = sawDisallowedTool(eventsText);
  if (toolName) throw new Error(`Audit reviewer attempted disallowed tool '${toolName}'. Review result discarded.`);
  if ((await readdir(workspace)).length !== 0) throw new Error("Audit reviewer modified its empty workspace");

  const agyResult = JSON.parse(await readFile(resultPath, utf8));
  if (!agyResult?.structured_output) throw new Error("Audit review did not return schema-enforced structured output");
  const capacityOnlyCompletion = agyResult.status === "ERROR"
    && sawFinishedReview(eventsText)
    && /^API error \(attempt \d+\): UNAVAILABLE \(code 503\): No capacity available for model [^ ]+ on the server$/u.test(String(agyResult.error || ""));
  if (agyResult.status !== "SUCCESS" && !capacityOnlyCompletion) throw new Error("Audit review did not end successfully");
  const reviewById = validateBatchReviewOutput(agyResult.structured_output, ids);
  await writeJson(batchReviewPath, agyResult.structured_output);

  const promoted = [];
  const drifted = [];
  for (const entry of entries) {
    let current = null;
    try {
      current = await loadEntry(entry.recordId, { precheck: false });
    } catch {
      drifted.push(entry.recordId);
      continue;
    }
    if (current.packetSha256 !== entry.packetSha256 || current.capturedEvidenceSha256 !== entry.capturedEvidenceSha256) {
      drifted.push(entry.recordId);
      continue;
    }
    const review = reviewById.get(entry.recordId);
    const reviewPath = join(runner, `AUDIT_REVIEW.${encodeURIComponent(entry.recordId)}.json`);
    await writeJson(reviewPath, review);
    const latestPath = auditReviewIndexPath(entry.recordId, { root: reviewRoot });
    const latestIndex = {
      schemaVersion: 1,
      recordId: entry.recordId,
      sessionId,
      completedAt: new Date().toISOString(),
      repoHead,
      packetSha256: entry.packetSha256,
      capturedEvidenceSha256: entry.capturedEvidenceSha256,
      reviewPath,
      review,
    };
    const tempPath = `${latestPath}.${process.pid}.tmp`;
    await writeJson(tempPath, latestIndex);
    await mkdir(dirname(latestPath), { recursive: true });
    const { rename } = await import("node:fs/promises");
    await rename(tempPath, latestPath);
    promoted.push({ recordId: entry.recordId, verdict: review.verdict, latestPath });
  }

  process.stdout.write(`${JSON.stringify({
    ok: drifted.length === 0,
    sessionId,
    repoHead,
    requestedCount: ids.length,
    promotedCount: promoted.length,
    drifted,
    promoted,
    elapsedMs: Date.now() - startedAt,
    completion: capacityOnlyCompletion ? "accepted-after-capacity-error" : "success",
  }, null, 2)}\n`);
}

await main();
