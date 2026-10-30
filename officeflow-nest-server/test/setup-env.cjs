// HTTP contract tests use mocked dependencies, never application credentials.
Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: '5001',
  DATABASE_URL: 'mysql://test:test@127.0.0.1:13307/officeflow_phase5_test',
  JWT_ACCESS_SECRET: 'http-test-secret-at-least-32-bytes-long',
  REDIS_URL: 'redis://127.0.0.1:16380',
  REDIS_KEY_PREFIX: 'officeflow:http-test',
  MAIL_ENABLED: 'false',
  AI_ENABLED: 'false',
  OPENAI_API_KEY: '',
  OPENAI_MODEL: '',
  OPENAI_TIMEOUT_MS: '25000',
  OPENAI_MAX_OUTPUT_TOKENS: '2500',
  FRONTEND_URL: 'http://localhost:3000',
  CLOUDINARY_CLOUD_NAME: 'test',
  CLOUDINARY_API_KEY: 'test',
  CLOUDINARY_API_SECRET: 'test',
  METRICS_TOKEN: 'a'.repeat(64),
});
delete process.env.RENDER_GIT_COMMIT;
