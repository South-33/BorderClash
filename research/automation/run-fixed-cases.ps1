param(
    [ValidateSet("all", "retrospective-anniversary", "disputed-single-chain", "humanitarian-claimant-scope", "required-source-unavailable")]
    [string]$Case = "all",
    [string]$WorkRoot = "",
    [switch]$Development
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$isSouth = [string]::Equals($env:COMPUTERNAME, "SouthServer", [StringComparison]::OrdinalIgnoreCase)
if (-not $isSouth -and -not $Development) {
    throw "Real BorderClash fixed cases require SouthServer unless -Development is explicitly selected."
}
if ($Development) {
    Write-Warning "Development fixed-case run only. This does not satisfy South-specific acceptance or authorize publication."
}

$model = "gemini-3.8-flash-medium"
$agyCommand = Get-Command agy -ErrorAction SilentlyContinue
$agy = if ($agyCommand) { $agyCommand.Source } else { Join-Path $env:LOCALAPPDATA "agy\bin\agy.exe" }
if (-not (Test-Path -LiteralPath $agy)) { throw "Antigravity CLI not found" }

$fixturesPath = Join-Path $repoRoot "research\fixtures\fixed-cases.json"
$evaluator = Join-Path $repoRoot "research\fixed-case-evaluator.mjs"
$supervisor = Join-Path $repoRoot "research\automation\agy-supervisor.mjs"
$defaultRoot = Join-Path $env:LOCALAPPDATA "BorderClash\fixed-cases"
$root = if ($WorkRoot) { [IO.Path]::GetFullPath($WorkRoot) } else { $defaultRoot }
$repoFull = [IO.Path]::GetFullPath($repoRoot).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
$rootFull = [IO.Path]::GetFullPath($root).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
$repoPrefix = $repoFull + [IO.Path]::DirectorySeparatorChar
if ($rootFull -eq $repoFull -or $rootFull.StartsWith($repoPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Fixed-case work root must be outside the repository so the model cannot inspect fixtures, evaluator code, or canonical data."
}
$root = $rootFull
New-Item -ItemType Directory -Force -Path $root | Out-Null
$workspaceRoot = Join-Path $root "workspaces"
$runnerRoot = Join-Path $root "runner"
New-Item -ItemType Directory -Force -Path $workspaceRoot, $runnerRoot | Out-Null

$fixtures = Get-Content -LiteralPath $fixturesPath -Raw | ConvertFrom-Json
$selected = @($fixtures | Where-Object { $Case -eq "all" -or $_.id -eq $Case })
if (-not $selected.Count) { throw "No fixed case selected" }

$canonicalAgents = [IO.File]::ReadAllText((Join-Path $repoRoot "AGENTS.md"), [Text.Encoding]::UTF8)
if (-not $canonicalAgents.StartsWith("This is the project's AGENTS.md")) {
    throw "Canonical AGENTS.md has an unexpected first line"
}

$nullableString = @{ anyOf = @(@{ type = "string" }, @{ type = "null" }) }
$nullableInteger = @{ anyOf = @(@{ type = "integer" }, @{ type = "null" }) }
$nullableBoolean = @{ anyOf = @(@{ type = "boolean" }, @{ type = "null" }) }
$schema = [ordered]@{
    type = "object"
    required = @(
        "caseId", "decision", "reviewReason", "eventDate", "eventTime", "claimant", "credibility",
        "independentEvidenceChains", "value", "qualifier", "scope", "combinedFigureKnown",
        "summaryEn", "summaryTh", "summaryKh"
    )
    properties = [ordered]@{
        caseId = @{ type = "string" }
        decision = @{ type = "string"; enum = @("complete", "review") }
        reviewReason = $nullableString
        eventDate = $nullableString
        eventTime = $nullableString
        claimant = $nullableString
        credibility = $nullableInteger
        independentEvidenceChains = $nullableInteger
        value = $nullableInteger
        qualifier = $nullableString
        scope = $nullableString
        combinedFigureKnown = $nullableBoolean
        summaryEn = $nullableString
        summaryTh = $nullableString
        summaryKh = $nullableString
    }
    additionalProperties = $false
}
$schemaPath = Join-Path $runnerRoot "fixed-case-result.schema.json"
[IO.File]::WriteAllText(
    $schemaPath,
    (($schema | ConvertTo-Json -Depth 20 -Compress) + [Environment]::NewLine),
    [Text.UTF8Encoding]::new($false)
)

[IO.File]::WriteAllText(
    (Join-Path $root "RUN_CONTEXT.json"),
    (([ordered]@{
        schemaVersion = 1
        mode = if ($Development) { "development" } else { "south-acceptance" }
        machine = [string]$env:COMPUTERNAME
        model = $model
        startedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        publicationEnabled = $false
        modelWorkspaceContainsEvidence = $false
    } | ConvertTo-Json -Depth 10) + [Environment]::NewLine),
    [Text.UTF8Encoding]::new($false)
)

foreach ($fixture in $selected) {
    $caseId = [string]$fixture.id
    $caseRoot = Join-Path $workspaceRoot $caseId
    $caseRunnerRoot = Join-Path $runnerRoot $caseId
    if (Test-Path -LiteralPath $caseRoot) { Remove-Item -LiteralPath $caseRoot -Recurse -Force }
    if (Test-Path -LiteralPath $caseRunnerRoot) { Remove-Item -LiteralPath $caseRunnerRoot -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $caseRoot, $caseRunnerRoot | Out-Null

    $evidence = [string]::Join([Environment]::NewLine, @($fixture.evidence | ForEach-Object { "- " + [string]$_ }))
    $prompt = @"
You are evaluating one controlled BorderClash editorial case. This is not a live research cycle.

Do not use tools, browse, inspect files or directories, or use facts outside this prompt. The model workspace is intentionally empty. The canonical AGENTS.md text below is provided directly so you can apply its editorial and evidence rules; operational commands, paths, scheduling, publication, and repository procedures inside it do not apply to this fixture.

<CANONICAL_AGENTS>
$canonicalAgents
</CANONICAL_AGENTS>

<FIXED_CASE>
Case ID: $caseId
Scenario: $([string]$fixture.title)

Evidence:
$evidence
</FIXED_CASE>

Return the schema-required object for this case. Use null only where a field is genuinely unsupported or does not apply. For every completed factual case, set credibility to a decile evidence score and independentEvidenceChains to the number of genuinely independent underlying evidence chains supported by the supplied evidence; repeated publication of one statement is one chain. Keep disputed claims attributed. Use ASCII digits in Thai and Khmer. If the supplied evidence is insufficient for a trustworthy required conclusion, choose review and explain why in reviewReason.

For structured qualifiers, use the canonical enum spelling: when the supplied evidence says "more than", set qualifier to "MORE_THAN" while preserving the same meaning in all three summaries.
For summaryEn, summaryTh, and summaryKh, write calendar months as words rather than numeric month tokens. For example, prefer "28 May 2025" over "2025-05-28" so translated month names do not create a false numeric-fidelity mismatch. Keep eventDate itself in YYYY-MM-DD form.
"@
    $promptPath = Join-Path $caseRunnerRoot "prompt.txt"
    $continuationPath = Join-Path $caseRunnerRoot "continuation.txt"
    [IO.File]::WriteAllText($promptPath, $prompt, [Text.UTF8Encoding]::new($false))
    [IO.File]::WriteAllText(
        $continuationPath,
        "Continue the same fixed editorial case. Do not use tools or outside facts. Return the schema-required result from the evidence already supplied.",
        [Text.UTF8Encoding]::new($false)
    )

    $resultPath = Join-Path $caseRunnerRoot "agy-result.json"
    $eventsPath = Join-Path $caseRunnerRoot "events.ndjson"
    $stderrPath = Join-Path $caseRunnerRoot "stderr.log"
    $sessionPath = Join-Path $caseRunnerRoot "session.json"
    $agyLogBase = Join-Path $caseRunnerRoot "agy"

    & node $supervisor `
        --agy $agy `
        --cwd $caseRoot `
        --model $model `
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
    if ($LASTEXITCODE -ne 0) { throw "AGY supervisor failed for fixed case $caseId" }

    foreach ($line in Get-Content -LiteralPath $eventsPath) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        try { $event = $line | ConvertFrom-Json } catch { continue }
        if (
            [string]$event.event -eq "step_update" -and
            $event.step_update -and
            [string]$event.step_update.step_type -eq "tool"
        ) {
            throw "Fixed case $caseId used disallowed tool '$([string]$event.step_update.tool_name)'. Fixed cases must use only prompt-supplied evidence."
        }
    }

    if (@(Get-ChildItem -LiteralPath $caseRoot -Force).Count -ne 0) {
        throw "Fixed case $caseId modified its empty model workspace."
    }

    $agyResult = [IO.File]::ReadAllText($resultPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
    if ([string]$agyResult.status -ne "SUCCESS") { throw "Fixed case $caseId did not end successfully" }
    if (-not $agyResult.PSObject.Properties["structured_output"] -or -not $agyResult.structured_output) {
        throw "Fixed case $caseId did not return schema-enforced structured output"
    }

    $caseResultPath = Join-Path $caseRunnerRoot "CASE_RESULT.json"
    [IO.File]::WriteAllText(
        $caseResultPath,
        (($agyResult.structured_output | ConvertTo-Json -Depth 20) + [Environment]::NewLine),
        [Text.UTF8Encoding]::new($false)
    )
    & node $evaluator $fixturesPath $caseResultPath
    if ($LASTEXITCODE -ne 0) { throw "Fixed case evaluation failed for $caseId" }
}

Write-Output "fixed cases passed: $($selected.Count)"
