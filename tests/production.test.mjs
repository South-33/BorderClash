import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('Vercel auto-deploys only main', () => {
  const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  assert.equal(config.git?.deploymentEnabled?.['*'], false);
  assert.equal(config.git?.deploymentEnabled?.main, true);
});

test('production research runs from main through one Windows task', () => {
  const production = fs.readFileSync('research/automation/run-scheduled.ps1', 'utf8');
  const installer = fs.readFileSync('research/automation/install-scheduler.ps1', 'utf8');

  assert.match(production, /git.+fetch.+main/s);
  assert.match(production, /git.+reset.+--hard.+main/s);
  assert.match(production, /research\\automation\\run-cycle\.ps1/);
  assert.match(production, /-Publish/);
  assert.match(production, /data\\research-state\.json/);
  assert.match(production, /\.work\\runner\\runtime\\runtime\.json/);
  assert.match(production, /SKIP: not-due/);
  assert.ok(
    production.indexOf('if (-not (Test-ResearchDue))') < production.indexOf('"fetch", $RemoteName, "main"'),
    'scheduler must check due state before waking Git/network',
  );
  const preflight = production.slice(
    production.indexOf('function Test-ResearchDue'),
    production.indexOf('function Invoke-Checked'),
  );
  assert.match(preflight, /runtime\.status.+resumable/s);
  assert.ok(
    preflight.indexOf('runtime.status') < preflight.indexOf('state.nextRunAt'),
    'resumable cycles must bypass the normal nextRunAt gate',
  );
  assert.doesNotMatch(preflight, /Write-Output/, 'preflight must return only a boolean');
  assert.match(production, /Write-Output \$script:preflightMessage/);

  assert.match(installer, /BorderClashResearch/);
  assert.match(installer, /research\\automation\\run-scheduled\.ps1/);
  assert.doesNotMatch(installer, /New-ScheduledTaskTrigger -AtStartup/);
  assert.match(installer, /New-ScheduledTaskTrigger -AtLogOn/);
  assert.match(installer, /RepetitionInterval/);
  assert.match(installer, /MultipleInstances IgnoreNew/);
  assert.match(installer, /-LogonType Interactive/);
  assert.match(installer, /-WakeToRun/);
  assert.match(installer, /EveryMinutes = 5/);
});
