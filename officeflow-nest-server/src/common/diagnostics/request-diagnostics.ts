import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';

type DiagnosticRequest = Request & {
  diagnosticRequestId?: string;
  diagnosticStartedAt?: number;
};

export function getRequestDiagnostics(request: Request) {
  const tracked = request as DiagnosticRequest;
  // Generate our own identifier; do not trust a client-supplied log value.
  tracked.diagnosticRequestId ??= randomUUID();
  tracked.diagnosticStartedAt ??= Date.now();
  return {
    requestId: tracked.diagnosticRequestId,
    durationMs: Date.now() - tracked.diagnosticStartedAt,
  };
}

export function getSafeErrorDetails(error: unknown) {
  const errorName =
    error instanceof Error && /^[A-Za-z][A-Za-z0-9_.]{0,79}$/.test(error.name)
      ? error.name
      : 'UnknownError';
  const code =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code
      : undefined;
  const hints: Record<string, string> = {
    P2021: 'missing_database_table_check_migrations',
    P2022: 'missing_database_column_check_migrations',
    P2028: 'transaction_api_error_check_expiry_or_acquisition',
    P2034: 'transaction_write_conflict_or_deadlock',
    P2002: 'unique_constraint',
    P2003: 'foreign_key_constraint',
    P2025: 'record_not_found',
  };
  // Prisma messages/meta can contain SQL, values and connection strings.
  // Keep only code, a fixed hint and stack locations, never the raw message.
  const stack =
    error instanceof Error
      ? error.stack
          ?.split('\n')
          .filter((line) => /^\s+at /.test(line) && !/:\/\//.test(line))
          .slice(0, 6)
          .join('\n')
      : undefined;
  return {
    errorName,
    code,
    hint: code && Object.hasOwn(hints, code) ? hints[code] : undefined,
    stack,
  };
}
