import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import {
  getRequestDiagnostics,
  getSafeErrorDetails,
} from './request-diagnostics';

describe('Request diagnostics', () => {
  it('creates an internal ID and reuses it across interceptor/filter', () => {
    const request = {
      headers: { 'x-request-id': 'untrusted-client-value' },
    } as unknown as Request;
    const first = getRequestDiagnostics(request);
    expect(first.requestId).toMatch(/^[a-f0-9-]{36}$/);
    expect(getRequestDiagnostics(request).requestId).toBe(first.requestId);
  });
  it('does not include the raw error message', () => {
    const details = getSafeErrorDetails(
      new Error('password=secret; token=secret'),
    );
    expect(JSON.stringify(details)).not.toContain('password=');
    expect(JSON.stringify(details)).not.toContain('token=');
    expect(details.errorName).toBe('Error');
  });

  it.each(['message', 'meta'] as const)(
    'extracts expiry timing from %s without exposing raw details',
    (location) => {
      const detail =
        'A query cannot be executed on an expired transaction. ' +
        'The timeout for this transaction was 5000 ms, however 6866 ms passed since the start of the transaction. ' +
        'password=secret; SELECT private_data';
      const error = new Prisma.PrismaClientKnownRequestError(
        location === 'message' ? detail : 'Private query',
        {
          code: 'P2028',
          clientVersion: '7',
          meta: location === 'meta' ? { error: detail } : undefined,
        },
      );
      const details = getSafeErrorDetails(error);
      expect(details).toMatchObject({
        code: 'P2028',
        transactionFailure: 'expired',
        transactionTimeoutMs: 5000,
        transactionElapsedMs: 6866,
      });
      expect(JSON.stringify(details)).not.toMatch(
        /secret|private_data|Private query/,
      );
    },
  );

  it.each([
    ['Unable to start a transaction in the given time.', 'start_timeout'],
    [
      'A query cannot be executed on a committed transaction.',
      'already_committed',
    ],
    [
      'A query cannot be executed on a transaction that was rolled back.',
      'already_rolled_back',
    ],
    ['Unrecognized transaction error password=secret', 'unknown'],
    ['A query cannot be executed on an expired transaction.', 'expired'],
  ])('classifies %s without inventing timeout numbers', (message, category) => {
    const details = getSafeErrorDetails(
      new Prisma.PrismaClientKnownRequestError(message, {
        code: 'P2028',
        clientVersion: '7',
      }),
    );
    expect(details).toMatchObject({ transactionFailure: category });
    expect(details).not.toHaveProperty('transactionTimeoutMs');
    expect(details).not.toHaveProperty('transactionElapsedMs');
    expect(JSON.stringify(details)).not.toContain('secret');
  });

  it('does not classify other Prisma codes as transaction failures', () => {
    const details = getSafeErrorDetails(
      new Prisma.PrismaClientKnownRequestError(
        'A query cannot be executed on an expired transaction.',
        { code: 'P2021', clientVersion: '7' },
      ),
    );
    expect(details).not.toHaveProperty('transactionFailure');
  });

  it.each([
    [
      'getaddrinfo ENOTFOUND private-host password=secret',
      'ENOTFOUND',
      'dns_not_found',
    ],
    [
      { code: 'EAI_AGAIN', message: 'password=secret' },
      'EAI_AGAIN',
      'dns_temporary_failure',
    ],
    ['connect ECONNREFUSED private-host', 'ECONNREFUSED', 'connection_refused'],
    ['connect ETIMEDOUT private-host', 'ETIMEDOUT', 'connection_timeout'],
  ])(
    'extracts the nested database network cause %# without leaking details',
    (cause, networkCode, failure) => {
      const details = getSafeErrorDetails(
        new Prisma.PrismaClientKnownRequestError('SELECT private_data', {
          code: 'P2010',
          clientVersion: '7',
          meta: { driverAdapterError: { cause: { code: 45028, cause } } },
        }),
      );
      expect(details).toMatchObject({
        code: 'P2010',
        databaseNetworkCode: networkCode,
        databaseFailure: failure,
      });
      expect(JSON.stringify(details)).not.toMatch(
        /private-host|secret|private_data/,
      );
    },
  );

  it('reports pool acquisition failure without inventing a network cause', () => {
    const details = getSafeErrorDetails(
      new Prisma.PrismaClientKnownRequestError('Private query', {
        code: 'P2010',
        clientVersion: '7',
        meta: {
          driverAdapterError: {
            cause: { originalCode: '45028', cause: 'private details' },
          },
        },
      }),
    );
    expect(details).toMatchObject({
      databaseFailure: 'connection_pool_unavailable',
    });
    expect(details).not.toHaveProperty('databaseNetworkCode');
    expect(JSON.stringify(details)).not.toContain('private details');
  });

  it('identifies the RSA authentication failure hidden by the pool error', () => {
    const details = getSafeErrorDetails(
      new Prisma.PrismaClientKnownRequestError('Private SQL', {
        code: 'P2010',
        clientVersion: '7',
        meta: {
          driverAdapterError: {
            cause: {
              code: 45028,
              cause:
                '(conn:559, no: 45044, SQLState: 08S01) RSA public key is not available client side. password=secret',
            },
          },
        },
      }),
    );
    expect(details).toMatchObject({
      databaseFailure: 'rsa_public_key_unavailable',
      hint: 'enable_database_tls_with_trusted_ca',
    });
    expect(JSON.stringify(details)).not.toMatch(
      /Private SQL|password=|secret|conn:559/,
    );
  });

  it.each([
    undefined,
    null,
    {},
    { cause: { cause: 'query contains ENOTFOUND' } },
  ])(
    'does not mislabel an unrelated raw-query failure as a connection failure %#',
    (driverAdapterError) => {
      const details = getSafeErrorDetails(
        new Prisma.PrismaClientKnownRequestError('Invalid SQL', {
          code: 'P2010',
          clientVersion: '7',
          meta: { driverAdapterError },
        }),
      );
      expect(details).not.toHaveProperty('databaseFailure');
      expect(details).not.toHaveProperty('databaseNetworkCode');
    },
  );
});
