const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const safe = {
  ...process.env,
  NODE_ENV: 'test',
  PHASE5_INTEGRATION: '1',
  DATABASE_URL: 'mysql://phase5_test:phase5-test-only@127.0.0.1:13307/officeflow_phase5_test',
  REDIS_URL: 'redis://127.0.0.1:16380',
  REDIS_KEY_PREFIX: 'officeflow-phase5-0123abcd',
};
const check = (overrides) => spawnSync(process.execPath, [
  path.resolve(__dirname, '../test/integration/safety.cjs'),
], { env: { ...safe, ...overrides }, encoding: 'utf8', windowsHide: true });

test('accepts only the disposable integration target', () => {
  assert.equal(check({}).status, 0);
});

for (const overrides of [
  { NODE_ENV: 'production' },
  { PHASE5_INTEGRATION: '' },
  { DATABASE_URL: 'mysql://user:private-password@production.invalid/defaultdb' },
  { DATABASE_URL: 'mysql://phase5_test:phase5-test-only@127.0.0.1:13307/officeflow_helpdesk' },
  { REDIS_URL: 'redis://127.0.0.1:6380' },
  { REDIS_KEY_PREFIX: 'officeflow:production' },
]) {
  test(`rejects unsafe override for ${Object.keys(overrides)[0]}`, () => {
    const result = check(overrides);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /isolated runner/);
    assert.doesNotMatch(result.stderr, /private-password/);
  });
}
