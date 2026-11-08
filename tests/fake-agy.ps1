param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

$mode = $env:BORDERCLASH_FAKE_AGY_MODE
if (-not $mode) { $mode = "success" }

if ($mode -eq "sleep") {
    Start-Sleep -Seconds 8
}

if ($mode -eq "fail") {
    [Console]::Error.WriteLine("deliberate fake Antigravity failure")
    exit 23
}

if ($mode -eq "invalid-data") {
    $statePath = Join-Path (Get-Location) "data\state.json"
    $state = Get-Content $statePath -Raw | ConvertFrom-Json
    $state.lastCycleInterval = 999
    $json = $state | ConvertTo-Json -Depth 20
    [IO.File]::WriteAllText($statePath, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}

if ($mode -eq "non-data") {
    Add-Content -Path (Join-Path (Get-Location) "README.md") -Value "unexpected agent edit"
}

if ($mode -eq "flip-pause") {
    $statePath = Join-Path (Get-Location) "data\state.json"
    $state = Get-Content $statePath -Raw | ConvertFrom-Json
    $state.isPaused = -not [bool]$state.isPaused
    $json = $state | ConvertTo-Json -Depth 20
    [IO.File]::WriteAllText($statePath, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}

$response = if ($mode -eq "unicode") {
    [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("4LiX4LiU4Liq4Lit4Lia4Lig4Liy4Lip4Liy4LmE4LiX4LiiIOGen+GetuGegOGem+GfkuGelOGehOGel+GetuGen+GetuGegeGfkuGemOGfguGemiA8IS0tIEdPQUxfQ09NUExFVEUgLS0+"))
} else {
    "fake cycle complete <!-- GOAL_COMPLETE -->"
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

