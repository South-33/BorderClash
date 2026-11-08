param(
    [string]$Model = "gemini-3.8-flash-medium",
    [int]$TimeoutSeconds = 120,
    [string]$AgyPath = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$fixture = Join-Path $repoRoot "benchmarks\reader-copy.txt"
$outDir = Join-Path $repoRoot ".work\benchmarks\reader-copy"
$outPath = Join-Path $outDir ($Model + ".json")
$agy = if ($AgyPath) { $AgyPath } elseif (Get-Command agy -ErrorAction SilentlyContinue) { (Get-Command agy).Source } else { throw "agy not found" }

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$prompt = @"
Read only this fixture: $fixture
Do not browse, research, edit files, or read other repository files.

For each numbered item, produce natural reader-facing English, everyday Thai for a Thai civilian, and everyday Khmer for a Cambodian civilian. These are independent rewrites of the same verified facts, not literal translations.

Hard constraints:
- preserve attribution, uncertainty, names, numbers, and factual meaning;
- do not infer consequences or strengthen claims;
- "moved forward" must not become "crossed/encroached";
- "displaced" must not become "unable to return home";
- "no reported armed clashes" must not become an absolute claim that none exist;
- keep claims attributed to the side making them;
- prefer short everyday wording over analyst, military, diplomatic, or bureaucratic jargon;
- Thai must contain no Khmer script; Khmer must contain no Thai script; use ASCII digits;
- add no facts.

Return only a compact numbered answer with EN, TH, and KH for each item.
"@

$previousConsoleEncoding = [Console]::OutputEncoding
$previousOutputEncoding = $OutputEncoding
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$stopwatch = [Diagnostics.Stopwatch]::StartNew()
try {
    [Console]::OutputEncoding = $utf8NoBom
    $OutputEncoding = $utf8NoBom
    $raw = $prompt | & $agy --output-format json --model $Model --print-timeout ($TimeoutSeconds.ToString() + "s") --disable-slash-commands
    $exitCode = $LASTEXITCODE
} finally {
    $stopwatch.Stop()
    [Console]::OutputEncoding = $previousConsoleEncoding
    $OutputEncoding = $previousOutputEncoding
}

if ($exitCode -ne 0) { throw "agy exited with code $exitCode" }
$rawText = [string]::Join([Environment]::NewLine, [string[]]$raw)
[IO.File]::WriteAllText($outPath, $rawText, $utf8NoBom)

$result = $rawText | ConvertFrom-Json
if ($result.status -ne "SUCCESS") { throw "benchmark status=$($result.status)" }

& node (Join-Path $repoRoot "scripts\check-reader-bench.mjs") $outPath
if ($LASTEXITCODE -ne 0) { throw "reader-copy benchmark validation failed" }

Write-Output ("model=" + $Model)
Write-Output ("seconds=" + [math]::Round($stopwatch.Elapsed.TotalSeconds, 2))
Write-Output ("result=" + $outPath)
