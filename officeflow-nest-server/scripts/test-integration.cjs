// Own only uniquely named disposable containers. Never read application .env.
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const project = `officeflow-phase5-${randomUUID().slice(0, 8)}`;
const compose = [
  'compose',
  '-f',
  path.join(root, 'test/integration/compose.yml'),
  '-p',
  project,
];
const testEnv = {
  ...process.env,
  NODE_ENV: 'test',
  PHASE5_INTEGRATION: '1',
  DATABASE_URL:
    'mysql://phase5_test:phase5-test-only@127.0.0.1:13307/officeflow_phase5_test',
  REDIS_URL: 'redis://127.0.0.1:16380',
  REDIS_KEY_PREFIX: project,
  MAIL_ENABLED: 'false',
  JWT_ACCESS_SECRET: 'phase5-local-test-secret-not-for-production',
};

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: 'inherit',
    windowsHide: true,
    timeout: 300000,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `Test command failed: ${path.basename(command)} (exit ${result.status ?? 'unavailable'})`,
    );
  }
}

let ownsProject = false;
try {
  run('docker', ['version', '--format', '{{.Server.Version}}']);
  ownsProject = true;
  run('docker', [...compose, 'up', '-d', '--wait', '--wait-timeout', '180']);
  // Explicit test-only environment overrides any dotenv-loaded application URL.
  run(
    process.execPath,
    ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    testEnv,
  );
  run(
    process.execPath,
    [
      '--experimental-vm-modules',
      'node_modules/jest/bin/jest.js',
      '--config',
      'test/integration/jest.config.cjs',
      '--runInBand',
    ],
    testEnv,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (ownsProject) {
    try {
      // No volume deletion: this project has no persistent volumes or bind mounts.
      run('docker', [...compose, 'down', '--timeout', '10']);
      console.log(
        `Removed disposable test containers for ${project}. Application containers/volumes were not targeted.`,
      );
    } catch {
      console.error(
        `Cleanup failed. Inspect Docker project ${project}; do not remove application volumes.`,
      );
      process.exitCode = 1;
    }
  }
}
