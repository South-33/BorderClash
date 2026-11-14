param(
    [Parameter(Mandatory = $true)]
    [string]$RecordId,
    [string]$SupplementalEvidenceFile = "",
    [string]$WorkRoot = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$supervisor = Join-Path $PSScriptRoot "agy-supervisor.mjs"
$researchCli = Join-Path $repoRoot "research\cli.mjs"
$model = "gemini-3.8-flash-medium"
$agyCommand = Get-Command agy -ErrorAction SilentlyContinue
$agy = if ($agyCommand) { $agyCommand.Source } else { Join-Path $env:LOCALAPPDATA "agy\bin\agy.exe" }
if (-not (Test-Path -LiteralPath $agy)) { throw "Antigravity CLI not found" }

$sessionId = [DateTimeOffset]::UtcNow.ToString("yyyyMMddTHHmmssfffZ")
$root = if ($WorkRoot) {
    [IO.Path]::GetFullPath($WorkRoot)
} else {
    Join-Path $env:LOCALAPPDATA "BorderClash\audit-reviews\$sessionId"
}
$repoFull = [IO.Path]::GetFullPath($repoRoot).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
$rootFull = [IO.Path]::GetFullPath($root).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
$repoPrefix = $repoFull + [IO.Path]::DirectorySeparatorChar
if ($rootFull -eq $repoFull -or $rootFull.StartsWith($repoPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Audit-review work root must stay outside the repository."
}
$root = $rootFull
$workspace = Join-Path $root "workspace"
$runner = Join-Path $root "runner"
New-Item -ItemType Directory -Force -Path $workspace, $runner | Out-Null

$packetPath = Join-Path $runner "AUDIT_PACKET.json"
$packetErrorPath = Join-Path $runner "audit-packet.stderr.log"
$packetProcess = Start-Process `
    -FilePath (Get-Command node).Source `
    -ArgumentList @($researchCli, "audit-show", $RecordId) `
    -WorkingDirectory $repoRoot `
    -RedirectStandardOutput $packetPath `
    -RedirectStandardError $packetErrorPath `
    -Wait `
    -PassThru
if ($packetProcess.ExitCode -ne 0) {
    $packetError = if (Test-Path -LiteralPath $packetErrorPath) {
        [IO.File]::ReadAllText($packetErrorPath, [Text.Encoding]::UTF8).Trim()
    } else { "" }
    throw "Could not build audit packet for $RecordId`: $packetError"
}
$packetText = [IO.File]::ReadAllText($packetPath, [Text.Encoding]::UTF8).Trim()
if (-not $packetText) { throw "Could not build audit packet for $RecordId" }
$null = $packetText | ConvertFrom-Json

$supplemental = "No supplemental evidence supplied."
if ($SupplementalEvidenceFile) {
    $supplementalPath = (Resolve-Path -LiteralPath $SupplementalEvidenceFile).Path
    $supplemental = [IO.File]::ReadAllText($supplementalPath, [Text.Encoding]::UTF8).Trim()
    if (-not $supplemental) { throw "Supplemental evidence file is empty" }
}

$agents = [IO.File]::ReadAllText((Join-Path $repoRoot "AGENTS.md"), [Text.Encoding]::UTF8)
$settings = [ordered]@{
    permissions = [ordered]@{
        deny = @(
            "command(*)",
            "read_file(*)",
            "write_file(*)",
            "read_url(*)",
            "execute_url(*)",
            "download_url(*)",
            "mcp(*)"
        )
    }
}
$settingsPath = Join-Path $runner "settings.json"
[IO.File]::WriteAllText(
    $settingsPath,
    (($settings | ConvertTo-Json -Depth 10) + [Environment]::NewLine),
    [Text.UTF8Encoding]::new($false)
)

$nullableString = @{ anyOf = @(@{ type = "string" }, @{ type = "null" }) }
$schema = [ordered]@{
    type = "object"
    required = @("recordId", "verdict", "supportedEventDate", "supportedEventTime", "claimsSupported", "issues", "rationale")
    properties = [ordered]@{
        recordId = @{ type = "string" }
        verdict = @{ type = "string"; enum = @("no_change", "change", "unresolved") }
        supportedEventDate = $nullableString
        supportedEventTime = $nullableString
        claimsSupported = @{ type = "boolean" }
        issues = @{ type = "array"; items = @{ type = "string" } }
        rationale = @{ type = "string" }
    }
    additionalProperties = $false
}
$schemaPath = Join-Path $runner "result.schema.json"
[IO.File]::WriteAllText(
    $schemaPath,
    (($schema | ConvertTo-Json -Depth 20 -Compress) + [Environment]::NewLine),
    [Text.UTF8Encoding]::new($false)
)

$prompt = @"
You are reviewing one real BorderClash canonical record from evidence supplied directly in this prompt.

Do not use tools, browse, inspect files, or use facts outside the supplied evidence. The model workspace is intentionally empty and sandboxed. Session permissions deny terminal, file, URL/download, and MCP access before execution; the runner also discards any review that emits a tool event. This is a nonpublishing audit review: do not propose operational actions and do not assume inaccessible South-only captures.

Apply the editorial/evidence rules in CANONICAL_AGENTS, but ignore its operational commands and publication procedures for this review.

<CANONICAL_AGENTS>
$agents
</CANONICAL_AGENTS>

<AUDIT_PACKET>
$packetText
</AUDIT_PACKET>

<SUPPLEMENTAL_EVIDENCE>
$supplemental
</SUPPLEMENTAL_EVIDENCE>

Return only the schema-required audit assessment. Preserve uncertainty. supportedEventDate must be YYYY-MM-DD when supported. supportedEventTime must be null unless the supplied evidence directly supports an exact time. A retrospective publication date is not an event date. verdict=change means at least one canonical factual field should change; verdict=unresolved means the supplied evidence cannot safely settle the material issue.
"@

$promptPath = Join-Path $runner "prompt.txt"
$continuationPath = Join-Path $runner "continuation.txt"
[IO.File]::WriteAllText($promptPath, $prompt, [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText(
    $continuationPath,
    "Continue the same audit review using only evidence already supplied. Do not use tools. Return the schema-required assessment.",
    [Text.UTF8Encoding]::new($false)
)

$resultPath = Join-Path $runner "agy-result.json"
$eventsPath = Join-Path $runner "events.ndjson"
$stderrPath = Join-Path $runner "stderr.log"
$sessionPath = Join-Path $runner "session.json"
$agyLogBase = Join-Path $runner "agy"

& node $supervisor `
    --agy $agy `
    --cwd $workspace `
    --model $model `
    --settings-file $settingsPath `
    --prompt-file $promptPath `
    --continuation-prompt-file $continuationPath `
    --result-file $resultPath `
    --events-file $eventsPath `
    --stderr-file $stderrPath `
    --session-file $sessionPath `
    --agy-log-base $agyLogBase `
    --json-schema-file $schemaPath `
    --timeout-minutes "10" `
    --stuck-minutes "15" `
    --retry-delay-ms "30000"
if ($LASTEXITCODE -ne 0) { throw "AGY supervisor failed for audit record $RecordId" }

foreach ($line in Get-Content -LiteralPath $eventsPath) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    try { $event = $line | ConvertFrom-Json } catch { continue }
    if ([string]$event.event -eq "step_update" -and $event.step_update -and [string]$event.step_update.step_type -eq "tool") {
        throw "Audit reviewer attempted disallowed tool '$([string]$event.step_update.tool_name)'. Permission rules prevented host access; review result discarded."
    }
}

if (@(Get-ChildItem -LiteralPath $workspace -Force).Count -ne 0) {
    throw "Audit reviewer modified its empty workspace"
}

$agyResult = [IO.File]::ReadAllText($resultPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
if ([string]$agyResult.status -ne "SUCCESS") { throw "Audit review did not end successfully" }
if (-not $agyResult.PSObject.Properties["structured_output"] -or -not $agyResult.structured_output) {
    throw "Audit review did not return schema-enforced structured output"
}
if ([string]$agyResult.structured_output.recordId -ne $RecordId) {
    throw "Audit review returned the wrong record id"
}

$reviewPath = Join-Path $runner "AUDIT_REVIEW.json"
[IO.File]::WriteAllText(
    $reviewPath,
    (($agyResult.structured_output | ConvertTo-Json -Depth 20) + [Environment]::NewLine),
    [Text.UTF8Encoding]::new($false)
)
Write-Output "audit review complete: $RecordId"
Write-Output "review=$reviewPath"
