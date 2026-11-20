import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runner = readFileSync("research/automation/run-audit-review.ps1", "utf8");

test("laptop audit reviewer is prompt-only and nonpublishing", () => {
  assert.match(runner, /gemini-3\.8-flash-medium/u);
  assert.match(runner, /command\(\*\)/u);
  assert.match(runner, /read_file\(\*\)/u);
  assert.match(runner, /write_file\(\*\)/u);
  assert.match(runner, /read_url\(\*\)/u);
  assert.match(runner, /execute_url\(\*\)/u);
  assert.match(runner, /download_url\(\*\)/u);
  assert.match(runner, /mcp\(\*\)/u);
  assert.match(runner, /--settings-file/u);
  assert.match(runner, /--json-schema-file/u);
  assert.match(runner, /attempted disallowed tool/u);
  assert.match(runner, /work root must stay outside the repository/iu);
  assert.match(runner, /result index must stay outside the repository/iu);
  assert.match(runner, /model workspace is intentionally empty/iu);
  assert.doesNotMatch(runner, /-Publish\b/u);
  assert.doesNotMatch(runner, /git\s+push/iu);
});

test("audit packet bypasses PowerShell native stdout decoding", () => {
  assert.match(runner, /RedirectStandardOutput \$packetPath/u);
  assert.match(runner, /ReadAllText\(\$packetPath, \[Text\.Encoding\]::UTF8\)/u);
  assert.doesNotMatch(runner, /audit-show[^\n]+Out-String/u);
});

test("audit reviewer automatically supplies archived publisher text", () => {
  assert.match(runner, /"audit-captured", \$RecordId/u);
  assert.match(runner, /CAPTURED_PUBLISHER_TEXT/u);
  assert.match(runner, /prefer the captured publisher text/u);
  assert.match(runner, /flag the summary mismatch/u);
  assert.match(runner, /RedirectStandardOutput \$capturedEvidencePath/u);
  assert.match(runner, /ReadAllText\(\$capturedEvidencePath, \[Text\.Encoding\]::UTF8\)/u);
});

test("audit reviewer persists a self-validating latest result index", () => {
  assert.match(runner, /latest-by-record/u);
  assert.match(runner, /packetSha256/u);
  assert.match(runner, /capturedEvidenceSha256/u);
  assert.match(runner, /repoHead/u);
  assert.match(runner, /latest=\$latestPath/u);
  assert.match(runner, /verdict=/u);
});

test("audit reviewer runs deterministic evidence precheck before model launch", () => {
  assert.match(runner, /precheck-audit-review\.mjs/u);
  assert.match(runner, /Audit-review precheck rejected/u);
  assert.match(runner, /if \(-not \$SupplementalEvidenceFile\)/u);
  assert.match(runner, /Push-Location -LiteralPath \$repoRoot/u);
  assert.match(runner, /Pop-Location/u);
  const precheckIndex = runner.indexOf("precheck-audit-review.mjs");
  const supervisorIndex = runner.indexOf("agy-supervisor.mjs");
  assert.ok(precheckIndex >= 0 && supervisorIndex >= 0);
  assert.ok(precheckIndex < runner.indexOf("& node $supervisor"));
});

test("audit reviewer prevents duplicate reviews and serializes model capacity per repository", () => {
  assert.match(runner, /Threading\.Mutex/u);
  assert.match(runner, /WaitOne\(0\)/u);
  assert.match(runner, /\$slotSeed = "\$gitCommonDir\|audit-review-model-slot"/u);
  assert.match(runner, /BorderClashAuditReviewSlot-/u);
  assert.match(runner, /\$reviewSlot\.WaitOne\(\)/u);
  assert.match(runner, /\$reviewSlot\.ReleaseMutex\(\)/u);
  assert.match(runner, /--git-common-dir/u);
  assert.match(runner, /Audit review already running for \$RecordId/u);

  const packetPreparationIndex = runner.indexOf('$promptPath = Join-Path $runner "prompt.txt"');
  const slotWaitIndex = runner.indexOf("$reviewSlotHeld = $reviewSlot.WaitOne()");
  const supervisorIndex = runner.indexOf("& node $supervisor");
  const slotReleaseIndex = runner.indexOf("$reviewSlot.ReleaseMutex()");
  assert.ok(packetPreparationIndex >= 0 && slotWaitIndex > packetPreparationIndex);
  assert.ok(supervisorIndex > slotWaitIndex);
  assert.ok(slotReleaseIndex > supervisorIndex);
});

test("audit reviewer refuses to promote a result if its packet drifts while the model runs", () => {
  assert.match(runner, /AUDIT_PACKET_CURRENT\.json/u);
  assert.match(runner, /CAPTURED_EVIDENCE_CURRENT\.json/u);
  assert.match(runner, /currentPacketSha256 -ne \$packetSha256/u);
  assert.match(runner, /currentCapturedEvidenceSha256 -ne \$capturedEvidenceSha256/u);
  assert.match(runner, /not promoted to latest-by-record/u);
  const driftIndex = runner.indexOf("source drifted while the model was running");
  const latestIndex = runner.indexOf('$latestRoot = Join-Path $auditReviewRoot "latest-by-record"');
  assert.ok(driftIndex >= 0 && latestIndex >= 0 && driftIndex < latestIndex);
});

test("audit reviewer accepts only completed structured reviews after an exact model-capacity error", () => {
  assert.match(runner, /\$sawFinishedReview = \$false/u);
  assert.match(runner, /step_type -eq "finish"/u);
  assert.match(runner, /state -eq "DONE"/u);
  assert.match(runner, /\$capacityOnlyCompletion/u);
  assert.match(
    runner,
    /UNAVAILABLE \\\(code 503\\\): No capacity available for model \[\^ \]\+ on the server/u,
  );
  assert.match(runner, /status -ne "SUCCESS" -and -not \$capacityOnlyCompletion/u);
  assert.match(runner, /completion=accepted-after-capacity-error/u);

  const structuredOutputIndex = runner.indexOf('PSObject.Properties["structured_output"]');
  const capacityIndex = runner.indexOf("$capacityOnlyCompletion");
  assert.ok(structuredOutputIndex >= 0 && capacityIndex > structuredOutputIndex);
});
