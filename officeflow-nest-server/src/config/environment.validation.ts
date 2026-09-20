export function validateEnvironment(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv = raw.NODE_ENV ?? 'development';
  const jwtAccessSecret = raw.JWT_ACCESS_SECRET;

  if (
    nodeEnv !== 'development' &&
    nodeEnv !== 'test' &&
    nodeEnv !== 'production'
  ) {
    throw new Error('NODE_ENV must be development, test or production');
  }

  const portInput = raw.PORT ?? '5001';

  if (typeof portInput !== 'string' || !/^\d+$/.test(portInput)) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const port = Number(portInput);

  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  if (
    typeof jwtAccessSecret !== 'string' ||
    Buffer.byteLength(jwtAccessSecret, 'utf8') < 32
  ) {
    throw new Error('JWT_ACCESS_SECRET must contain at least 32 bytes');
  }

  const databaseUrl = raw.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || databaseUrl.trim().length === 0) {
    throw new Error('DATABASE_URL is required');
  }

  let parsedDatabaseUrl: URL;
  try {
    parsedDatabaseUrl = new URL(databaseUrl);
  } catch {
    // Never expose the input URL: it may contain credentials.
    throw new Error('DATABASE_URL must be a valid MySQL URL');
  }

  if (
    parsedDatabaseUrl.protocol !== 'mysql:' ||
    !parsedDatabaseUrl.hostname ||
    parsedDatabaseUrl.pathname === '' ||
    parsedDatabaseUrl.pathname === '/'
  ) {
    throw new Error(
      'DATABASE_URL must use mysql:// and include a host and database name',
    );
  }

  const metricsToken = raw.METRICS_TOKEN;

  if (
    metricsToken !== undefined &&
    (typeof metricsToken !== 'string' || !/^[a-f0-9]{64}$/.test(metricsToken))
  ) {
    throw new Error(
      'METRICS_TOKEN must contain exactly 64 lowercase hexadecimal characters',
    );
  }
  return {
    ...raw,
    NODE_ENV: nodeEnv,
    PORT: port,
    JWT_ACCESS_SECRET: jwtAccessSecret,
    DATABASE_URL: databaseUrl,
  };
}
