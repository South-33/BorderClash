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
  assert.match(runner, /model workspace is intentionally empty/iu);
  assert.doesNotMatch(runner, /-Publish\b/u);
  assert.doesNotMatch(runner, /git\s+push/iu);
});

test("audit packet bypasses PowerShell native stdout decoding", () => {
  assert.match(runner, /RedirectStandardOutput \$packetPath/u);
  assert.match(runner, /ReadAllText\(\$packetPath, \[Text\.Encoding\]::UTF8\)/u);
  assert.doesNotMatch(runner, /audit-show[^\n]+Out-String/u);
});
