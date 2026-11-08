import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('Vercel auto-deploys only main', () => {
  const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  assert.equal(config.git?.deploymentEnabled?.['*'], false);
  assert.equal(config.git?.deploymentEnabled?.main, true);
});
