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

  assert.match(installer, /BorderClashResearch/);
  assert.match(installer, /research\\automation\\run-scheduled\.ps1/);
  assert.doesNotMatch(installer, /New-ScheduledTaskTrigger -AtStartup/);
  assert.match(installer, /New-ScheduledTaskTrigger -AtLogOn/);
  assert.match(installer, /RepetitionInterval/);
  assert.match(installer, /MultipleInstances IgnoreNew/);
});
