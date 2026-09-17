import { Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { EventEmitter } from 'node:events';

import { getCurrentRequestId } from '../diagnostics/request-context';
import { getRequestDiagnostics } from '../diagnostics/request-diagnostics';
import { requestObservabilityMiddleware } from './request-observability.middleware';

function createExchange(path: string | undefined = '/api/tickets/42') {
  const req = {
    method: 'GET',
    path,
    originalUrl: '/api/tickets/42?token=query-secret',
    headers: {
      'x-request-id': 'client-controlled-id',
      authorization: 'Bearer header-secret',
      cookie: 'session=cookie-secret',
    },
    body: { password: 'body-secret' },
  } as unknown as Request;
  const res = Object.assign(new EventEmitter(), {
    statusCode: 200,
    writableFinished: false,
    setHeader: jest.fn(),
  });
  return { req, res, response: res as unknown as Response };
}

describe('Request observability middleware', () => {
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('initializes diagnostics/header before next and runs next in context', () => {
    const { req, res, response } = createExchange();
    const next = jest.fn(() => {
      const { requestId } = getRequestDiagnostics(req);
      expect(requestId).toMatch(/^[a-f0-9-]{36}$/);
      expect(requestId).not.toBe('client-controlled-id');
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', requestId);
      expect(getCurrentRequestId()).toBe(requestId);
    });
    requestObservabilityMiddleware(req, response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(getCurrentRequestId()).toBeUndefined();
    res.emit('finish');
  });

  it('logs the final status once and removes both listeners after finish', () => {
    const { req, res, response } = createExchange();
    requestObservabilityMiddleware(req, response, jest.fn());
    res.statusCode = 201;
    res.writableFinished = true;
    res.emit('finish');
    res.emit('close');
    res.emit('finish');
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({
      event: 'http_request_completed',
      requestId: getRequestDiagnostics(req).requestId,
      method: 'GET',
      path: '/api/tickets/42',
      statusCode: 201,
      durationMs: expect.any(Number) as unknown,
    });
    const entry = (log.mock.calls[0] as unknown[])[0] as { durationMs: number };
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
    expect(warn).not.toHaveBeenCalled();
    expect(res.listenerCount('finish')).toBe(0);
    expect(res.listenerCount('close')).toBe(0);
  });

  it('logs an early close as aborted, never as a successful 200', () => {
    const { req, res, response } = createExchange();
    requestObservabilityMiddleware(req, response, jest.fn());
    res.emit('close');
    res.emit('finish');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'http_request_aborted',
        requestId: getRequestDiagnostics(req).requestId,
        statusCode: null,
      }),
    );
    expect(log).not.toHaveBeenCalled();
    expect(res.listenerCount('finish')).toBe(0);
    expect(res.listenerCount('close')).toBe(0);
  });

  it('treats close after writableFinished as completed, not aborted', () => {
    const { req, res, response } = createExchange();
    requestObservabilityMiddleware(req, response, jest.fn());
    res.writableFinished = true;
    res.emit('close');
    expect(log).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([401, 500])(
    'records a completed %i response with its actual status',
    (statusCode) => {
      const { req, res, response } = createExchange();
      requestObservabilityMiddleware(req, response, jest.fn());
      res.statusCode = statusCode;
      res.emit('finish');
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'http_request_completed',
          statusCode,
        }),
      );
    },
  );

  it('strips queries from the fallback URL and does not serialize secrets', () => {
    const { req, res, response } = createExchange();
    delete (req as Partial<Request>).path;
    requestObservabilityMiddleware(req, response, jest.fn());
    res.emit('finish');
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/tickets/42' }),
    );
    expect(JSON.stringify(log.mock.calls)).not.toMatch(
      /query-secret|header-secret|cookie-secret|body-secret|client-controlled-id/,
    );
  });

  it('captures the original path even if routing later changes request.path', () => {
    const { req, res, response } = createExchange();
    requestObservabilityMiddleware(req, response, jest.fn());
    Object.defineProperty(req, 'path', { value: '/rewritten' });
    res.emit('finish');
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/tickets/42' }),
    );
  });

  it('starts shared diagnostics before downstream code, not at the error filter', () => {
    jest.useFakeTimers();
    jest.setSystemTime(1000);
    const { req, res, response } = createExchange();
    requestObservabilityMiddleware(req, response, () => {
      jest.setSystemTime(1250);
      expect(getRequestDiagnostics(req).durationMs).toBe(250);
    });
    res.emit('finish');
  });

  it('keeps the correct ID when responses finish outside context in reverse order', () => {
    const first = createExchange();
    const second = createExchange();
    requestObservabilityMiddleware(first.req, first.response, jest.fn());
    requestObservabilityMiddleware(second.req, second.response, jest.fn());
    const firstId = getRequestDiagnostics(first.req).requestId;
    const secondId = getRequestDiagnostics(second.req).requestId;
    expect(firstId).not.toBe(secondId);
    expect(getCurrentRequestId()).toBeUndefined();
    second.res.emit('finish');
    first.res.emit('finish');
    expect(log).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ requestId: secondId }),
    );
    expect(log).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ requestId: firstId }),
    );
  });
});
