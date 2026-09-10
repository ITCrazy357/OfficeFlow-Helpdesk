// Read-only logical backup. Does not apply migrations or restore into any DB.
require('dotenv/config');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash, randomUUID } = require('node:crypto');

async function main() {
  if (process.env.ALLOW_PRODUCTION_BACKUP !== 'true') {
    throw new Error('Explicit production backup approval is required');
  }
  const backendRoot = path.resolve(__dirname, '..');
  const databaseUrl = new URL(process.env.DATABASE_URL || '');
  if (databaseUrl.protocol !== 'mysql:') throw new Error('Expected a MySQL DATABASE_URL');
  const database = decodeURIComponent(databaseUrl.pathname.slice(1));
  if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error('Unexpected database name; review manually');
  const dumpBinary = process.env.MYSQLDUMP_PATH || 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe';
  const certificate = path.join(backendRoot, 'certs', 'ca.pem');
  if (!fs.existsSync(certificate) || !fs.existsSync(dumpBinary)) throw new Error('Verified CA certificate or mysqldump binary is unavailable');
  const backupDirectory = path.join(backendRoot, '.backups');
  // Refuse to write a database dump unless Git excludes it.
  execFileSync('git', ['check-ignore', path.join(backupDirectory, 'probe.sql')], { cwd: backendRoot, stdio: 'pipe' });
  fs.mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
  const basename = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`;
  const privateDirectory = path.join(backupDirectory, basename);
  fs.mkdirSync(privateDirectory, { mode: 0o700 });
  if (process.platform === 'win32') {
    const identity = execFileSync('whoami', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true });
    const sid = identity.match(/S-1-[0-9-]+/)?.[0];
    if (!sid) throw new Error('Cannot establish backup owner');
    // Restrict this newly created directory to this Windows user and SYSTEM.
    execFileSync('icacls', [privateDirectory, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F'], { stdio: 'pipe', windowsHide: true });
  }
  const completePath = path.join(privateDirectory, 'database.sql');
  const partialPath = `${completePath}.partial`;
  console.log('Creating a consistent read-only backup with verified TLS. No production writes.');
  try {
    execFileSync(dumpBinary, [
      '--single-transaction', '--quick', '--skip-lock-tables', '--no-tablespaces',
      '--set-gtid-purged=OFF', '--column-statistics=0', '--routines', '--events',
      '--triggers', '--hex-blob', '--default-character-set=utf8mb4',
      '--ssl-mode=VERIFY_IDENTITY', `--ssl-ca=${certificate}`,
      `--host=${databaseUrl.hostname}`, `--port=${databaseUrl.port || '3306'}`,
      `--user=${decodeURIComponent(databaseUrl.username)}`, `--result-file=${partialPath}`,
      database,
    ], {
      // Never place the password in command arguments or output.
      env: { ...process.env, MYSQL_PWD: decodeURIComponent(databaseUrl.password) },
      timeout: 180_000, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    const size = fs.statSync(partialPath).size;
    const descriptor = fs.openSync(partialPath, 'r');
    const tail = Buffer.alloc(Math.min(size, 4096));
    try { fs.readSync(descriptor, tail, 0, tail.length, size - tail.length); }
    finally { fs.closeSync(descriptor); }
    if (!tail.toString('utf8').includes('-- Dump completed on')) throw new Error('Missing completion marker');
    fs.renameSync(partialPath, completePath);
    const hash = createHash('sha256');
    for await (const chunk of fs.createReadStream(completePath)) hash.update(chunk);
    console.log(JSON.stringify({ path: completePath, bytes: size, sha256: hash.digest('hex'), restoreTested: false }));
  } catch (error) {
    console.error(`Backup failed. Any partial file at ${partialPath} is NOT a usable backup. No migration was applied.`);
    // The child error object can contain credentials via command/environment metadata.
    if (typeof error?.status === 'number') console.error(`mysqldump exit code: ${error.status}`);
    process.exitCode = 1;
  }
}

main().catch(() => {
  console.error('Backup preflight failed. Check configuration, CA, binary and Git ignore rules; no database changes were made.');
  process.exitCode = 1;
});
