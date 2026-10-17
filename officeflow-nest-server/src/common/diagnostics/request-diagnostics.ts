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
    ...getTransactionFailureDetails(error),
    ...getDatabaseConnectionFailureDetails(error),
    stack,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getDatabaseConnectionFailureDetails(error: unknown) {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2010'
  ) {
    return {};
  }

  const adapterError = error.meta?.driverAdapterError;
  if (!isRecord(adapterError) || !isRecord(adapterError.cause)) return {};
  const driverError = adapterError.cause;
  const cause = driverError.cause;
  // Read the adapter's nested cause; never emit its raw message, URL or SQL.
  const networkCode =
    isRecord(cause) && typeof cause.code === 'string'
      ? cause.code
      : typeof cause === 'string'
        ? /^(?:getaddrinfo|connect|read|write) (ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|ECONNRESET|EHOSTUNREACH|ENETUNREACH)(?:\s|$)/.exec(
            cause,
          )?.[1]
        : undefined;
  const failures: Record<string, string> = {
    ENOTFOUND: 'dns_not_found',
    EAI_AGAIN: 'dns_temporary_failure',
    ECONNREFUSED: 'connection_refused',
    ETIMEDOUT: 'connection_timeout',
    ECONNRESET: 'connection_reset',
    EHOSTUNREACH: 'host_unreachable',
    ENETUNREACH: 'network_unreachable',
  };
  if (networkCode && Object.hasOwn(failures, networkCode)) {
    return {
      databaseFailure: failures[networkCode],
      databaseNetworkCode: networkCode,
      hint: 'check_database_endpoint_and_network_from_deployment',
    };
  }
  if (
    typeof cause === 'string' &&
    /\bno:\s*45044\b/.test(cause) &&
    cause.includes('RSA public key is not available client side')
  ) {
    return {
      databaseFailure: 'rsa_public_key_unavailable',
      hint: 'enable_database_tls_with_trusted_ca',
    };
  }
  if (driverError.code === 45028 || driverError.originalCode === '45028') {
    return {
      databaseFailure: 'connection_pool_unavailable',
      hint: 'check_database_connectivity_and_driver_cause',
    };
  }
  return {};
}

function getTransactionFailureDetails(error: unknown) {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2028'
  ) {
    return {};
  }

  // Inspect internally, but emit only allowlisted categories and numbers.
  // Never return the raw Prisma message or meta (which can contain SQL/data).
  const detail =
    typeof error.meta?.error === 'string' ? error.meta.error : error.message;
  if (/cannot be executed on an expired transaction\./.test(detail)) {
    const timing =
      /The timeout for this transaction was (\d{1,9}) ms, however (\d{1,9}) ms passed since the start of the transaction\./.exec(
        detail,
      );
    return {
      transactionFailure: 'expired',
      ...(timing
        ? {
            transactionTimeoutMs: Number(timing[1]),
            transactionElapsedMs: Number(timing[2]),
          }
        : {}),
    };
  }
  if (detail.includes('Unable to start a transaction in the given time.')) {
    return { transactionFailure: 'start_timeout' };
  }
  if (detail.includes('cannot be executed on a committed transaction.')) {
    return { transactionFailure: 'already_committed' };
  }
  if (
    detail.includes('cannot be executed on a transaction that was rolled back.')
  ) {
    return { transactionFailure: 'already_rolled_back' };
  }
  return { transactionFailure: 'unknown' };
}
