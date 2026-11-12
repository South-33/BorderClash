$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

$mode = $env:BORDERCLASH_FAKE_AGY_MODE
if (-not $mode) { $mode = "success" }
$cliArgs = @($args)
$conversationIndex = [Array]::IndexOf($cliArgs, "--conversation")
$isResume = $conversationIndex -ge 0 -and $conversationIndex + 1 -lt $cliArgs.Count
$conversationArg = if ($isResume) { [string]$cliArgs[$conversationIndex + 1] } else { "" }
$outputFormatIndex = [Array]::IndexOf($cliArgs, "--output-format")
if ($outputFormatIndex -lt 0 -or $outputFormatIndex + 1 -ge $cliArgs.Count -or $cliArgs[$outputFormatIndex + 1] -ne "stream-json") {
    [Console]::Error.WriteLine("fake Antigravity requires stream-json output")
    exit 28
}

function Write-StreamEvent {
    param($Value)
    [Console]::Out.WriteLine(($Value | ConvertTo-Json -Depth 30 -Compress))
    [Console]::Out.Flush()
}

if ($env:BORDERCLASH_EXPECT_MODEL) {
    $modelIndex = [Array]::IndexOf($cliArgs, "--model")
    if ($modelIndex -lt 0 -or $modelIndex + 1 -ge $cliArgs.Count -or $cliArgs[$modelIndex + 1] -ne $env:BORDERCLASH_EXPECT_MODEL) {
        [Console]::Error.WriteLine("unexpected model argument")
        exit 26
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

if ($mode -ne "stale-state") {
    & node research/cli.mjs finish 12 "Fake cycle completed for runner validation." | Out-Null
    if ($LASTEXITCODE -ne 0) {
        [Console]::Error.WriteLine("fake cycle could not finalize scheduler state")
        exit 24
    }
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

if ($mode -eq "invalid-data") {
    $statePath = Join-Path (Get-Location) "data\research-state.json"
    $state = Get-Content $statePath -Raw | ConvertFrom-Json
    $state.lastCycleInterval = 999
    $json = $state | ConvertTo-Json -Depth 20
    [IO.File]::WriteAllText($statePath, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}

if ($mode -eq "non-data") {
    Add-Content -Path (Join-Path (Get-Location) "README.md") -Value "unexpected agent edit"
}

if ($mode -eq "flip-pause") {
    $statePath = Join-Path (Get-Location) "data\research-state.json"
    $state = Get-Content $statePath -Raw | ConvertFrom-Json
    $state.isPaused = -not [bool]$state.isPaused
    $json = $state | ConvertTo-Json -Depth 20
    [IO.File]::WriteAllText($statePath, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
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

