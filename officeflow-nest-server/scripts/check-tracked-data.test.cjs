const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findTrackedDataExports } = require('./check-tracked-data.cjs');

test('allows migration SQL and unrelated application files', () => {
  assert.deepEqual(
    findTrackedDataExports([
      'officeflow-nest-server/src/prisma/migrations/20261030120000_example/migration.sql',
      'officeflow-nest-server/src/users/users.service.ts',
    ]),
    [],
  );
});

test('rejects original exports, renamed dumps and compressed SQL anywhere in the repo', () => {
  const files = [
    'officeflow-nest-server/officeflow-deploy.sql',
    'officeflow-nest-server/officeflow-local-before-sync.sql',
    'docs/database.SQL',
    'backup.sql.gz',
    'archive/export.sql.zip',
    'archive/export.sql.zst',
    'officeflow-nest-server/src/prisma/migrations/example/dump.sql',
  ];
  assert.deepEqual(findTrackedDataExports(files), files);
});
