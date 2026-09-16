import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';

import { RequestLoggingInterceptor } from './request-logging.interceptor';

describe('RequestLoggingInterceptor', () => {
  const interceptor = new RequestLoggingInterceptor();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should log request method, URL, status, user and IP', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/api/audit-logs?keyword=confidential',
          ip: '127.0.0.1',
          user: {
            userId: 1,
          },
        }),
        getResponse: () => ({
          statusCode: 200,
          setHeader: jest.fn(),
        }),
      }),
    } as unknown as ExecutionContext;
    const next = {
      handle: () => of({ items: [] }),
    } as CallHandler;

    await lastValueFrom(interceptor.intercept(context, next));

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'http_handler_succeeded',
        method: 'GET',
        path: '/api/audit-logs',
        statusCode: 200,
        userId: 1,
        ip: '127.0.0.1',
      }),
    );
  });
});
