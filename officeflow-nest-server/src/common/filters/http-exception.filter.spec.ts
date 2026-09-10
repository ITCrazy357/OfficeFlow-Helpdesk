import { ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const json = jest.fn();
  const errorLog = jest.fn();
  const status = jest.fn(() => ({ json }));
  const request = { originalUrl: '/api/users' } as Request;
  const setHeader = jest.fn();
  const response = { status, setHeader } as unknown as Response;
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ArgumentsHost;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    jest.spyOn(Logger.prototype, 'error').mockImplementation(errorLog);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it.each(['P2021', 'P2028'])(
    'logs a safe production diagnostic for %s and correlates the response',
    (code) => {
      const originalEnvironment = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const exception = new Prisma.PrismaClientKnownRequestError(
          'SQL containing password=secret-value',
          { code, clientVersion: 'test', meta: { token: 'secret-token' } },
        );
        new HttpExceptionFilter().catch(exception, host);
        const diagnostic = (errorLog.mock.calls[0] as unknown[])[0] as {
          requestId: string;
          code: string;
        };
        expect(diagnostic.code).toBe(code);
        expect(JSON.stringify(diagnostic)).not.toContain('secret-value');
        expect(JSON.stringify(diagnostic)).not.toContain('secret-token');
        expect(setHeader).toHaveBeenCalledWith(
          'X-Request-Id',
          diagnostic.requestId,
        );
        expect(json).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 500,
            message: 'Internal server error',
            requestId: diagnostic.requestId,
          }),
        );
      } finally {
        process.env.NODE_ENV = originalEnvironment;
      }
    },
  );

  it.each([
    ['P2002', 'Duplicate value violates unique constraint'],
    ['P2003', 'Foreign key constraint failed'],
  ])('maps Prisma %s constraint failures to 409', (code, message) => {
    const exception = new Prisma.PrismaClientKnownRequestError(message, {
      code,
      clientVersion: 'test',
    });

    new HttpExceptionFilter().catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.CONFLICT,
        message,
      }),
    );
  });

  it('logs transaction expiry details only on the server', () => {
    const exception = new Prisma.PrismaClientKnownRequestError('Private SQL', {
      code: 'P2028',
      clientVersion: '7',
      meta: {
        error:
          'A query cannot be executed on an expired transaction. ' +
          'The timeout for this transaction was 5000 ms, however 6866 ms passed since the start of the transaction.',
      },
    });
    new HttpExceptionFilter().catch(exception, host);
    expect(errorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionFailure: 'expired',
        transactionTimeoutMs: 5000,
        transactionElapsedMs: 6866,
      }),
    );
    const body = (json.mock.calls[0] as unknown[])[0];
    expect(body).not.toHaveProperty('transactionFailure');
    expect(JSON.stringify(body)).not.toContain('Private SQL');
  });
});
