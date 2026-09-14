// Fail closed before test modules can create clients. Never fall back to .env.
const expectedDatabase =
  'mysql://phase5_test:phase5-test-only@127.0.0.1:13307/officeflow_phase5_test';
if (
  process.env.NODE_ENV !== 'test' ||
  process.env.PHASE5_INTEGRATION !== '1' ||
  process.env.DATABASE_URL !== expectedDatabase ||
  process.env.REDIS_URL !== 'redis://127.0.0.1:16380' ||
  !/^officeflow-phase5-[a-f0-9]{8}$/.test(process.env.REDIS_KEY_PREFIX || '')
) {
  throw new Error(
    'Integration tests require the isolated runner: npm run test:integration. Application database URLs are not allowed.',
  );
}
