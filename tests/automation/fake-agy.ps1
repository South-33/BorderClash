$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

$mode = $env:BORDERCLASH_FAKE_AGY_MODE
if (-not $mode) { $mode = "success" }
$researchCli = if ($env:BORDERCLASH_TRUSTED_RESEARCH_CLI) { $env:BORDERCLASH_TRUSTED_RESEARCH_CLI } else { "research/cli.mjs" }
$cliArgs = @($args)
$conversationIndex = [Array]::IndexOf($cliArgs, "--conversation")
$isResume = $conversationIndex -ge 0 -and $conversationIndex + 1 -lt $cliArgs.Count
$conversationArg = if ($isResume) { [string]$cliArgs[$conversationIndex + 1] } else { "" }
$outputFormatIndex = [Array]::IndexOf($cliArgs, "--output-format")
if ($outputFormatIndex -lt 0 -or $outputFormatIndex + 1 -ge $cliArgs.Count -or $cliArgs[$outputFormatIndex + 1] -ne "stream-json") {
    [Console]::Error.WriteLine("fake Antigravity requires stream-json output")
    exit 28
}
$inputFormatIndex = [Array]::IndexOf($cliArgs, "--input-format")
if ($inputFormatIndex -lt 0 -or $inputFormatIndex + 1 -ge $cliArgs.Count -or $cliArgs[$inputFormatIndex + 1] -ne "stream-json") {
    [Console]::Error.WriteLine("fake Antigravity requires stream-json input")
    exit 36
}
$streamInputLine = [Console]::In.ReadLine()
if ([string]::IsNullOrWhiteSpace($streamInputLine)) {
    [Console]::Error.WriteLine("fake Antigravity requires one stdin prompt event")
    exit 37
}
try { $streamInput = $streamInputLine | ConvertFrom-Json } catch {
    [Console]::Error.WriteLine("fake Antigravity received invalid stream-json input")
    exit 38
}
if ([string]$streamInput.event -ne "user" -or [string]$streamInput.message.role -ne "user") {
    [Console]::Error.WriteLine("fake Antigravity received unexpected stream-json prompt shape")
    exit 39
}
$streamPrompt = [string](($streamInput.message.content | ForEach-Object { [string]$_.text }) -join "")
if (-not $streamPrompt) {
    [Console]::Error.WriteLine("fake Antigravity received an empty stream-json prompt")
    exit 40
}
if ($env:BORDERCLASH_EXPECT_PROMPT_MIN_CHARS -and $streamPrompt.Length -lt [int]$env:BORDERCLASH_EXPECT_PROMPT_MIN_CHARS) {
    [Console]::Error.WriteLine("stream-json prompt was shorter than expected")
    exit 41
}

function Write-StreamEvent {
    param($Value)
    $line = ($Value | ConvertTo-Json -Depth 30 -Compress) + [Environment]::NewLine
    $bytes = [Text.Encoding]::UTF8.GetBytes($line)
    $stdout = [Console]::OpenStandardOutput()
    $stdout.Write($bytes, 0, $bytes.Length)
    $stdout.Flush()
}

function Write-UntrackedRecoveryArticle {
    param([string]$Slug)

    $newMonth = Join-Path (Get-Location) "data\news\2024-02.jsonl"
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $newMonth) | Out-Null
    $article = [ordered]@{
        id = "recovery-$Slug-fixture"
        category = "diplomatic"
        fetchedAt = [int64]1706745600000
        publishedAt = [int64]1706745600000
        source = "Recovery Fixture"
        sourceUrl = "https://example.invalid/borderclash-$Slug"
        sourceVerifiedAt = [int64]1706745600000
        status = "archived"
        summary = "Synthetic recovery fixture used only by the local automation suite."
        title = "Synthetic BorderClash recovery fixture"
        mediaEnvironment = "international"
        credibility = 50
    }
    [IO.File]::WriteAllText(
        $newMonth,
        (($article | ConvertTo-Json -Compress) + [Environment]::NewLine),
        [Text.UTF8Encoding]::new($false)
    )
    return $newMonth
}

if ($env:BORDERCLASH_EXPECT_MODEL) {
    $modelIndex = [Array]::IndexOf($cliArgs, "--model")
    if ($modelIndex -lt 0 -or $modelIndex + 1 -ge $cliArgs.Count -or $cliArgs[$modelIndex + 1] -ne $env:BORDERCLASH_EXPECT_MODEL) {
        [Console]::Error.WriteLine("unexpected model argument")
        exit 26
    }
}

if ($mode -eq "trust-boundary") {
    $sentinel = "borderclash-publication-secret-sentinel"
    $leaked = @(Get-ChildItem Env: | Where-Object { [string]$_.Value -eq $sentinel })
    if ($leaked.Count -gt 0) {
        [Console]::Error.WriteLine("publication credential leaked to fake agent: " + (($leaked | Select-Object -ExpandProperty Name) -join ","))
        exit 30
    }
    if ($env:GIT_CONFIG_NOSYSTEM -ne "1") {
        [Console]::Error.WriteLine("system Git config was not disabled for agent process")
        exit 31
    }
    if ($env:GCM_CREDENTIAL_STORE -ne "none") {
        [Console]::Error.WriteLine("Git Credential Manager store was not disabled for agent process")
        exit 35
    }
    $nullConfig = if ($IsWindows -or $env:OS -eq "Windows_NT") { "NUL" } else { "/dev/null" }
    if ($env:GIT_CONFIG_GLOBAL -ne $nullConfig) {
        [Console]::Error.WriteLine("global Git config was not isolated for agent process")
        exit 32
    }
    $helpers = @(& git config --get-all credential.helper 2>$null)
    if ($helpers.Count -gt 0) {
        [Console]::Error.WriteLine("Git credential helper remained visible to agent process")
        exit 33
    }
    $expectedGhRoot = [IO.Path]::GetFullPath((Join-Path (Get-Location) ".work\agent-gh-config"))
    if ([IO.Path]::GetFullPath([string]$env:GH_CONFIG_DIR) -ne $expectedGhRoot) {
        [Console]::Error.WriteLine("GitHub CLI config was not isolated inside the agent workspace")
        exit 34
    }
}

$cycleContext = Join-Path (Get-Location) ".work\CYCLE_CONTEXT.md"
if (-not (Test-Path $cycleContext)) {
    [Console]::Error.WriteLine("missing generated cycle context")
    exit 22
}
$cycleContextText = Get-Content $cycleContext -Raw
if (($cycleContextText -split "`r?`n").Count -lt 10) {
    [Console]::Error.WriteLine("cycle context must be compact multiline text")
    exit 21
}
if (-not $cycleContextText.Contains("# BorderClash cycle context")) {
    [Console]::Error.WriteLine("cycle context is missing its heading")
    exit 20
}

if ($mode -eq "sleep") {
    Start-Sleep -Seconds 8
}

if ($mode -eq "fail") {
    [Console]::Error.WriteLine("deliberate fake Antigravity failure")
    exit 23
}

$defaultConversation = if ($mode -eq "timeout-resume") {
    "fake-timeout-conversation"
} elseif ($mode -eq "retryable-resume") {
    "fake-retryable-conversation"
} elseif ($mode -eq "timeout-persistent") {
    "fake-persistent-conversation"
} elseif ($mode -eq "stuck-resume") {
    "fake-stuck-conversation"
} else {
    "fake-test-conversation"
}
$currentConversation = if ($isResume) { $conversationArg } else { $defaultConversation }
Write-StreamEvent ([ordered]@{
    event = "init"
    conversation_id = $currentConversation
    init = @{
        model = "fake-model"
        cwd = (Get-Location).Path
        tools = @("run_command", "write_to_file")
        permission_mode = "always-proceed"
    }
})

if ($mode -eq "session-lock") {
    $sessionPath = Join-Path (Get-Location) ".work\AGY_SESSION.json"
    $deadline = (Get-Date).AddSeconds(5)
    while (-not (Test-Path -LiteralPath $sessionPath) -and (Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 25
    }
    if (-not (Test-Path -LiteralPath $sessionPath)) {
        [Console]::Error.WriteLine("session-lock fixture did not observe supervisor session state")
        exit 32
    }
    $lock = [IO.File]::Open($sessionPath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::None)
    try {
        Write-StreamEvent ([ordered]@{
            event = "step_update"
            step_update = [ordered]@{
                conversation_id = $currentConversation
                step_index = 1
                state = "DONE"
                step_type = "checkpoint"
            }
        })
        Start-Sleep -Milliseconds 500
    } finally {
        $lock.Dispose()
    }
}

if ($mode -eq "stop-sleep") {
    Write-UntrackedRecoveryArticle "operator-stop" | Out-Null
    Start-Sleep -Seconds 30
}

if ($mode -eq "review") {
    & node $researchCli finish --review "Fake cycle needs operator review." | Out-Null
    if ($LASTEXITCODE -ne 0) {
        [Console]::Error.WriteLine("fake cycle could not request review")
        exit 24
    }
} elseif ($mode -notin @("stale-state", "stuck-resume")) {
    & node $researchCli finish 12 "Fake cycle completed for runner validation." | Out-Null
    if ($LASTEXITCODE -ne 0) {
        [Console]::Error.WriteLine("fake cycle could not finalize scheduler state")
        exit 24
    }
}

if ($mode -eq "untracked-fail") {
    $newMonth = Join-Path (Get-Location) "data\news\2024-02.jsonl"
    [IO.File]::WriteAllText($newMonth, '{"id":"recovery-new-month-fixture"}' + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
    [Console]::Error.WriteLine("deliberate failure after creating an untracked month")
    exit 25
}

if ($mode -in @("timeout-resume", "retryable-resume")) {
    $expectedConversation = if ($mode -eq "timeout-resume") { "fake-timeout-conversation" } else { "fake-retryable-conversation" }
    if ($isResume -and $conversationArg -ne $expectedConversation) {
        [Console]::Error.WriteLine("unexpected conversation argument")
        exit 27
    }
    if (-not $isResume) {
        $finishedReason = if ($mode -eq "timeout-resume") { "print_timeout" } else { "error" }
        Write-StreamEvent ([ordered]@{
            event = "result"
            result = [ordered]@{
                conversation_id = $expectedConversation
                status = "ERROR"
                response = "partial fake cycle"
                error = if ($mode -eq "timeout-resume") { "print timeout with turn in progress" } else { "temporary provider capacity failure" }
                duration_seconds = 1
                num_turns = 1
                usage = @{ input_tokens = 1; output_tokens = 1; thinking_tokens = 0; cache_read_tokens = 0; total_tokens = 2 }
                finished_reason = $finishedReason
            }
        })
        if ($mode -eq "timeout-resume") {
            [Console]::Error.WriteLine('AGY_ERROR: {"short_error":"print timeout","status":"DEADLINE_EXCEEDED","retryable":false}')
        } else {
            [Console]::Error.WriteLine('AGY_ERROR: {"short_error":"No capacity available","status":"UNAVAILABLE","error_code":503,"retryable":true}')
        }
        exit 3
    }
}

if ($mode -eq "timeout-persistent") {
    $countPath = Join-Path (Get-Location) ".work\fake-recovery-count.txt"
    $count = if (Test-Path -LiteralPath $countPath) { [int](Get-Content -LiteralPath $countPath -Raw) } else { 0 }
    $count++
    [IO.File]::WriteAllText($countPath, [string]$count, [Text.UTF8Encoding]::new($false))
    if ($count -le 2) {
        Write-StreamEvent ([ordered]@{
            event = "result"
            result = [ordered]@{
                conversation_id = $currentConversation
                status = "ERROR"
                response = "partial fake cycle"
                error = "print timeout with turn in progress"
                duration_seconds = 1
                num_turns = $count
                usage = @{ input_tokens = 1; output_tokens = 1; thinking_tokens = 0; cache_read_tokens = 0; total_tokens = 2 }
                finished_reason = "print_timeout"
            }
        })
        [Console]::Error.WriteLine('AGY_ERROR: {"short_error":"print timeout","status":"DEADLINE_EXCEEDED","retryable":false}')
        exit 3
    }
}

if ($mode -eq "stuck-resume" -and -not $isResume) {
    Write-UntrackedRecoveryArticle "stuck-watchdog" | Out-Null
    Start-Sleep -Seconds 30
}

if ($mode -eq "invalid-data") {
    $impactPath = Join-Path (Get-Location) "data\current\impact.json"
    $impact = Get-Content $impactPath -Raw | ConvertFrom-Json
    $impact.displaced.qualifier = "INVALID"
    $json = $impact | ConvertTo-Json -Depth 20
    [IO.File]::WriteAllText($impactPath, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}

if ($mode -eq "workspace-validator-attack") {
    $validatorPath = Join-Path (Get-Location) "research\validate.mjs"
    [IO.File]::WriteAllText(
        $validatorPath,
        'process.stdout.write("UNTRUSTED VALIDATOR RAN\n"); process.exit(0);' + [Environment]::NewLine,
        [Text.UTF8Encoding]::new($false)
    )
    & git update-index --assume-unchanged -- research/validate.mjs
    if ($LASTEXITCODE -ne 0) {
        [Console]::Error.WriteLine("could not hide workspace validator fixture from ordinary Git diff")
        exit 35
    }
    $impactPath = Join-Path (Get-Location) "data\current\impact.json"
    $impact = Get-Content $impactPath -Raw | ConvertFrom-Json
    $impact.displaced.qualifier = "INVALID"
    $json = $impact | ConvertTo-Json -Depth 20
    [IO.File]::WriteAllText($impactPath, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}

if ($mode -eq "non-data") {
    Add-Content -Path (Join-Path (Get-Location) "README.md") -Value "unexpected agent edit"
}

if ($mode -in @("flip-pause", "flip-pause-workspace-marker")) {
    $statePath = Join-Path (Get-Location) "data\research-state.json"
    $state = Get-Content $statePath -Raw | ConvertFrom-Json
    $state.isPaused = -not [bool]$state.isPaused
    $json = $state | ConvertTo-Json -Depth 20
    [IO.File]::WriteAllText($statePath, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}

if ($mode -eq "flip-pause-workspace-marker") {
    $runMeta = Get-Content (Join-Path (Get-Location) ".work\CYCLE_RUN.json") -Raw | ConvertFrom-Json
    $finish = Get-Content (Join-Path (Get-Location) ".work\research-finish.json") -Raw | ConvertFrom-Json
    $forged = [ordered]@{
        schemaVersion = 1
        cycleId = [string]$runMeta.runId
        baseHead = [string]$runMeta.baseHead
        completedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        nextRunAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + [int64]3600000
        intervalHours = [double]$finish.intervalHours
        reason = [string]$finish.reason
        researchCycleCount = [int64]$state.researchCycleCount + 1
    }
    [IO.File]::WriteAllText(
        (Join-Path (Get-Location) ".work\RUNNER_COMPLETION.json"),
        (($forged | ConvertTo-Json -Depth 20) + [Environment]::NewLine),
        [Text.UTF8Encoding]::new($false)
    )
}

if ($mode -eq "summary-change") {
    $summaryPath = Join-Path (Get-Location) "data\current\summary.json"
    $mutator = Join-Path $PSScriptRoot "mutate-fixture.mjs"
    & node $mutator append-summary $summaryPath " Fake validated summary change."
    if ($LASTEXITCODE -ne 0) {
        [Console]::Error.WriteLine("fake cycle could not apply UTF-8-safe summary fixture")
        exit 29
    }
}

$response = if ($mode -eq "unicode") {
    [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("4LiX4LiU4Liq4Lit4Lia4Lig4Liy4Lip4Liy4LmE4LiX4LiiIOGen+GetuGegOGem+GfkuGelOGehOGel+GetuGen+GetuGegeGfkuGemOGfguGemiA8IS0tIEdPQUxfQ09NUExFVEUgLS0+")) + [Environment]::NewLine + "HARNESS_FEEDBACK: none"
} elseif ($mode -eq "feedback") {
    "HARNESS_FEEDBACK: Fake harness feedback." + [Environment]::NewLine + "<!-- GOAL_COMPLETE -->"
} elseif ($mode -eq "missing-feedback") {
    "fake cycle complete" + [Environment]::NewLine + "<!-- GOAL_COMPLETE -->"
} else {
    "fake cycle complete" + [Environment]::NewLine + "HARNESS_FEEDBACK: none" + [Environment]::NewLine + "<!-- GOAL_COMPLETE -->"
}

Write-StreamEvent ([ordered]@{
    event = "result"
    result = [ordered]@{
        conversation_id = $currentConversation
        status = "SUCCESS"
        response = $response
        duration_seconds = 0.01
        num_turns = 1
        usage = @{
            input_tokens = 0
            output_tokens = 0
            thinking_tokens = 0
            cache_read_tokens = 0
            total_tokens = 0
        }
    }
})

