$mode = $env:BORDERCLASH_FAKE_AGY_MODE
if (-not $mode) { $mode = "success" }

if ($env:BORDERCLASH_EXPECT_MODEL) {
    $cliArgs = @($args)
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

if ($mode -ne "stale-state") {
    & node research/cli.mjs finish 12 "Fake cycle completed for runner validation." | Out-Null
    if ($LASTEXITCODE -ne 0) {
        [Console]::Error.WriteLine("fake cycle could not finalize scheduler state")
        exit 24
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
} elseif ($mode -eq "note") {
    "HARNESS_FEEDBACK: Fake harness feedback." + [Environment]::NewLine + "<!-- GOAL_COMPLETE -->"
} elseif ($mode -eq "missing-feedback") {
    "fake cycle complete" + [Environment]::NewLine + "<!-- GOAL_COMPLETE -->"
} else {
    "fake cycle complete" + [Environment]::NewLine + "HARNESS_FEEDBACK: none" + [Environment]::NewLine + "<!-- GOAL_COMPLETE -->"
}

[ordered]@{
    conversation_id = "fake-test-conversation"
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
} | ConvertTo-Json -Compress

