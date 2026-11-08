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

if ($mode -eq "commit") {
    Add-Content -Path (Join-Path (Get-Location) "README.md") -Value "unexpected agent commit"
    git add README.md
    git -c user.name=BorderClash-Test -c user.email=borderclash-test@example.invalid commit -m "test: agent commit" | Out-Null
}

[ordered]@{
    conversation_id = "fake-test-conversation"
    status = "SUCCESS"
    response = "fake cycle complete <!-- GOAL_COMPLETE -->"
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

