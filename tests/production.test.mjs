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
  const schedulePolicy = fs.readFileSync('research/automation/schedule-policy.ps1', 'utf8');
  const runner = fs.readFileSync('research/automation/run-cycle.ps1', 'utf8');
  const supervisor = fs.readFileSync('research/automation/agy-supervisor.mjs', 'utf8');
  const installer = fs.readFileSync('research/automation/install-scheduler.ps1', 'utf8');
  const supervised = fs.readFileSync('research/automation/run-supervised.ps1', 'utf8');

  assert.match(production, /git.+fetch.+main/s);
  assert.match(production, /FetchAttempts = 6/);
  assert.match(production, /FetchRetrySeconds = 30/);
  assert.match(production, /function Invoke-BoundedFetch/);
  assert.match(production, /for \(\$attempt = 1; \$attempt -le \$FetchAttempts; \$attempt\+\+\)/);
  assert.match(production, /Start-Sleep -Seconds \$FetchRetrySeconds/);
  assert.match(production, /failed after \$FetchAttempts bounded attempts/);
  assert.match(production, /git.+status.+--porcelain/s);
  assert.match(production, /git.+merge.+--ff-only.+main/s);
  assert.doesNotMatch(production, /git.+reset.+--hard/s);
  assert.match(production, /research\\automation\\run-cycle\.ps1/);
  assert.match(production, /-Publish/);
  assert.match(production, /data\\research-state\.json/);
  assert.match(production, /\.work\\runner\\runtime\\runtime\.json/);
  assert.match(production, /SKIP: not-due/);
  assert.ok(
    production.indexOf('if (-not (Test-ResearchDue))') < production.lastIndexOf('Invoke-BoundedFetch'),
    'scheduler must check due state before waking Git/network',
  );
  const preflight = production.slice(
    production.indexOf('function Test-ResearchDue'),
    production.indexOf('function Invoke-Checked'),
  );
  assert.match(preflight, /runtime\.status.+running.+resumable.+ready/s);
  assert.ok(
    preflight.indexOf('runtime.status') < preflight.indexOf('state.nextRunAt'),
    'active recovery state must bypass the normal nextRunAt gate',
  );
  assert.doesNotMatch(preflight, /Write-Output/, 'preflight must return only a boolean');
  assert.match(production, /Write-Output \$script:preflightMessage/);
  assert.match(production, /Get-ResearchLeadMinutes/);
  assert.match(production, /-StartLeadMinutes \$script:leadMinutes/);
  assert.match(schedulePolicy, /MinimumSamples = 3/);
  assert.match(schedulePolicy, /SampleLimit = 10/);
  assert.match(schedulePolicy, /BufferMinutes = 30/);
  assert.match(schedulePolicy, /MaximumLeadMinutes = 360/);

  assert.match(installer, /BorderClashResearch/);
  assert.match(installer, /research\\automation\\run-scheduled\.ps1/);
  assert.doesNotMatch(installer, /New-ScheduledTaskTrigger -AtStartup/);
  assert.match(installer, /New-ScheduledTaskTrigger -AtLogOn/);
  assert.match(installer, /RepetitionInterval/);
  assert.match(installer, /MultipleInstances IgnoreNew/);
  assert.match(installer, /-LogonType Interactive/);
  assert.match(installer, /-WakeToRun/);
  assert.match(installer, /-ExecutionTimeLimit \(\[TimeSpan\]::Zero\)/);
  assert.match(installer, /EveryMinutes = 5/);

  assert.match(runner, /\[int\]\$TimeoutMinutes = 0/);
  assert.match(runner, /\$productionModel = "gemini-3\.8-flash-medium"/);
  assert.doesNotMatch(runner, /BORDERCLASH_RESEARCH_MODEL/);
  assert.doesNotMatch(runner, /\[string\]\$Model/);
  assert.match(runner, /Publication is disabled for this supervised cycle/u);
  assert.match(runner, /verify public delivery afterward/u);
  assert.match(runner, /capture-changed/u);
  assert.match(runner, /canonical validation will continue/u);
  assert.match(runner, /Evidence identity review required for a manually edited article/u);
  assert.match(runner, /Real BorderClash research may run only on SouthServer/);
  assert.match(runner, /agy-supervisor\.mjs/);
  assert.match(runner, /AGY_SESSION\.json/);
  assert.match(runner, /runner_interrupted_after_success/);
  assert.match(runner, /runner_interrupted_after_error/);
  assert.match(runner, /RECOVER:.*validating without another model call/);
  assert.doesNotMatch(runner, /AGY_ERROR:/, 'PowerShell must not parse AGY stderr protocol');

  assert.match(supervisor, /--output-format"[\s\S]+"stream-json"/);
  assert.match(supervisor, /--settings/);
  assert.match(supervisor, /"--sandbox"/);
  assert.match(supervisor, /event\.event === "init"/);
  assert.match(supervisor, /conversationId/);
  assert.match(supervisor, /maxImmediateRecoveries = 1/);
  assert.match(supervisor, /RETRY:/);
  assert.match(supervisor, /timeoutMinutes > 0/);
  assert.match(supervisor, /recoveryReason === "print_timeout".*activeTimeoutMinutes = 0/s);

  assert.match(supervised, /Real supervised BorderClash research may run only on SouthServer/);
  assert.match(supervised, /BORDERCLASH_EVIDENCE_ARCHIVE/);
  assert.match(supervised, /BORDERCLASH_EVIDENCE_BACKUP/);
  assert.match(supervised, /publicationEnabled = \$false/);
  assert.match(supervised, /"Global\\BorderClashResearchCycle"/);
  assert.match(supervised, /-RunsRoot/);
  assert.match(supervised, /-RuntimeDir/);
  assert.match(supervised, /-LogDir/);
  assert.match(supervised, /SUPERVISED: publication disabled/);
  assert.doesNotMatch(supervised, /["']-Publish["']/u);
  assert.match(supervised, /Supervised work and evidence roots must stay outside the Git checkout/);
  assert.match(supervised, /pnpm\.cmd/);
  assert.match(supervised, /SUPERVISED_REPORT\.json/);
  assert.match(supervised, /probe-agent-auth\.mjs/);
  assert.match(supervised, /--push-dry-run true/);
  assert.match(supervised, /readyForSouthPrivilegeAcceptance/);
  assert.match(supervised, /Agent privilege probe did not prove publication write access is unavailable/);
  assert.match(supervised, /agentAuthProbePath/);
  assert.match(supervised, /archive-verify/);
  assert.match(supervised, /archive-restore/);
});
