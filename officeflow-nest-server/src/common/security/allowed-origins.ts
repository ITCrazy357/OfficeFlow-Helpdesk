function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getAllowedOrigins(): string[] {
  const configuredOrigins = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin)
    .filter((origin): origin is string => origin !== null);

  const developmentOrigins =
    process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000'];

  return [...new Set([...developmentOrigins, ...configuredOrigins])];
}
