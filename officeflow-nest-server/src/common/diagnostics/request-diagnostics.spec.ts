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
});
