const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_ACQUIRE_TIMEOUT_MS = 20_000;

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
