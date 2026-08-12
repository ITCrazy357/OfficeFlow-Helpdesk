import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const request = { originalUrl: '/api/users' } as Request;
  const response = { status } as unknown as Response;
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ArgumentsHost;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

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
});
