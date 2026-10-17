import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ConnectionOptions as TlsOptions } from 'node:tls';
import type { PoolConfig } from 'mariadb';

const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_ACQUIRE_TIMEOUT_MS = 20_000;

function isAiven(url: URL): boolean {
  return url.hostname.toLowerCase().endsWith('.aivencloud.com');
}

function getCaPath(url: URL, configuredPath?: string): string | undefined {
  return (
    configuredPath ||
    url.searchParams.get('sslCa') ||
    url.searchParams.get('sslcert') ||
    (isAiven(url) ? resolve(__dirname, '../../certs/ca.pem') : undefined)
  );
}

export function getDatabaseUrl(databaseUrl = process.env.DATABASE_URL): string {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    // Avoid including credentials from the connection string in startup errors.
    throw new Error('DATABASE_URL must be a valid connection URL');
  }

  // Aiven's MySQL CLI parameter is not understood by the MariaDB driver.
  const sslMode = url.searchParams.get('ssl-mode')?.toUpperCase();
  if (
    isAiven(url) ||
    ['REQUIRED', 'VERIFY_CA', 'VERIFY_IDENTITY'].includes(sslMode ?? '')
  ) {
    if (url.searchParams.get('ssl') === 'false' || sslMode === 'DISABLED') {
      throw new Error('Database TLS is required; remove disabled SSL options');
    }
    url.searchParams.set('ssl', 'true');
  }

  // MariaDB connector options use milliseconds. Preserve explicit URL options,
  // including TLS settings, and avoid its one-second connection default.
  if (!url.searchParams.has('connectTimeout')) {
    url.searchParams.set('connectTimeout', String(DEFAULT_CONNECT_TIMEOUT_MS));
  }
  if (!url.searchParams.has('acquireTimeout')) {
    url.searchParams.set('acquireTimeout', String(DEFAULT_ACQUIRE_TIMEOUT_MS));
  }

  return url.toString();
}

export function getDatabaseAdapterConfig(
  databaseUrl: string,
  configuredCaPath?: string,
): string | PoolConfig {
  const normalized = getDatabaseUrl(databaseUrl);
  const url = new URL(normalized);
  const caPath = getCaPath(url, configuredCaPath);
  if (!caPath) return normalized;
  if (url.searchParams.get('ssl') === 'false') {
    throw new Error('Database TLS CA cannot be combined with ssl=false');
  }

  // Preserve driver URL options when supplying the CA as a TLS object.
  const numericPoolOptions = new Set([
    'connectTimeout',
    'acquireTimeout',
    'connectionLimit',
    'idleTimeout',
    'initializationTimeout',
    'minimumIdle',
    'minDelayValidation',
    'leakDetectionTimeout',
    'pingTimeout',
  ]);
  const options = Object.fromEntries(
    [...url.searchParams].map(([key, value]) => {
      if (numericPoolOptions.has(key)) return [key, Number(value)];
      if (value === 'true' || value === 'false') return [key, value === 'true'];
      if (
        key === 'connectAttributes' ||
        (key === 'sessionVariables' && value.startsWith('{'))
      ) {
        try {
          return [key, JSON.parse(value) as unknown];
        } catch {
          throw new Error(`DATABASE_URL has invalid ${key} JSON`);
        }
      }
      return [key, value];
    }),
  );
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const ssl: TlsOptions = {
    ca: readFileSync(caPath),
    rejectUnauthorized: true,
    servername: host,
  };
  return {
    ...options,
    host,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    ssl,
  };
}

export function getMigrationDatabaseUrl(
  databaseUrl: string,
  configuredCaPath?: string,
): string {
  const url = new URL(getDatabaseUrl(databaseUrl));
  const caPath = getCaPath(url, configuredCaPath);
  if (caPath) {
    // Prisma CLI uses its own MySQL connector, rather than the runtime adapter.
    url.searchParams.set('sslcert', resolve(caPath));
    url.searchParams.set('sslaccept', 'strict');
  }
  return url.toString();
}
