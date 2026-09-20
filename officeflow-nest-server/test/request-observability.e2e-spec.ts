import {
  CanActivate,
  Controller,
  Get,
  INestApplication,
  Injectable,
  Logger,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';

import { getCurrentRequestId } from '../src/common/diagnostics/request-context';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { requestObservabilityMiddleware } from '../src/common/middleware/request-observability.middleware';

@Injectable()
class ContextProbeService {
  async inspect() {
    const before = getCurrentRequestId();
    await new Promise<void>((resolve) => setImmediate(resolve));
    return { before, after: getCurrentRequestId() };
  }
}

@Injectable()
class RejectingGuard implements CanActivate {
  canActivate(): boolean {
    throw new UnauthorizedException('Test guard rejection');
  }
}

@Controller('probe')
class ProbeController {
  constructor(private readonly probe: ContextProbeService) {}

  @Get()
  inspect() {
    return this.probe.inspect();
  }

  @Get('guarded')
  @UseGuards(RejectingGuard)
  guarded() {
    throw new Error('Guard must prevent handler execution');
  }

  @Get('failure')
  fail() {
    throw new Error('password=private-test-secret');
  }
}

type LogEntry = {
  event: string;
  requestId: string;
  statusCode: number;
  path: string;
};

// Real Nest/Express lifecycle with no AppModule, database, Redis or cloud clients.
describe('Request observability (HTTP)', () => {
  let app: INestApplication;
  let server: Server;
  let access: jest.SpyInstance;
  let warning: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProbeController],
      providers: [ContextProbeService, RejectingGuard],
    }).compile();
    app = module.createNestApplication();
    const metrics = { recordHttp: jest.fn() };
    app.use((req: Request, res: Response, next: NextFunction) => {
      requestObservabilityMiddleware(req, res, next, metrics);
    });
    app.setGlobalPrefix('api');
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    server = app.getHttpServer() as Server;
  });

  beforeEach(() => {
    access = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warning = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await app.close();
  });

  function expectAccess(requestId: string, statusCode: number, path: string) {
    const entries = access.mock.calls
      .map((call: unknown[]) => call[0] as LogEntry)
      .filter((entry) => entry.requestId === requestId);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      event: 'http_request_completed',
      requestId,
      statusCode,
      path,
    });
  }

  it('correlates header, async service context and access log without leaking input', async () => {
    const res = await request(server)
      .get('/api/probe?token=query-test-secret')
      .set('X-Request-Id', 'untrusted-client-id')
      .set('Authorization', 'Bearer header-test-secret')
      .set('Cookie', 'session=cookie-test-secret')
      .expect(200);
    const id = res.headers['x-request-id'];
    expect(id).toMatch(/^[a-f0-9-]{36}$/);
    expect(id).not.toBe('untrusted-client-id');
    expect(res.body as unknown).toMatchObject({
      data: { before: id, after: id },
    });
    expectAccess(id, 200, '/api/probe');
    expect(JSON.stringify(access.mock.calls)).not.toMatch(
      /query-test-secret|header-test-secret|cookie-test-secret|untrusted-client-id/,
    );
    expect(warning).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(getCurrentRequestId()).toBeUndefined();
  });

  it('keeps IDs isolated across concurrent HTTP requests', async () => {
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        request(server).get('/api/probe').expect(200),
      ),
    );
    const ids = responses.map((res) => res.headers['x-request-id']);
    expect(new Set(ids).size).toBe(8);
    for (const res of responses) {
      const id = res.headers['x-request-id'];
      expect(res.body as unknown).toMatchObject({
        data: { before: id, after: id },
      });
      expectAccess(id, 200, '/api/probe');
    }
  });

  it('correlates guard rejection with one diagnostic and one access event', async () => {
    const res = await request(server).get('/api/probe/guarded').expect(401);
    const id = res.headers['x-request-id'];
    expect(id).toMatch(/^[a-f0-9-]{36}$/);
    expect(res.body as unknown).toMatchObject({
      requestId: id,
      statusCode: 401,
    });
    expectAccess(id, 401, '/api/probe/guarded');
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'http_request_failed',
        requestId: id,
        statusCode: 401,
      }),
    );
    expect(error).not.toHaveBeenCalled();
  });

  it('correlates 500 diagnostics without exposing the raw error', async () => {
    const res = await request(server).get('/api/probe/failure').expect(500);
    const id = res.headers['x-request-id'];
    expect(res.body as unknown).toMatchObject({
      requestId: id,
      message: 'Internal server error',
    });
    expectAccess(id, 500, '/api/probe/failure');
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'http_request_failed',
        requestId: id,
        statusCode: 500,
      }),
    );
    expect(
      JSON.stringify([res.body, access.mock.calls, error.mock.calls]),
    ).not.toContain('private-test-secret');
  });

  it('tracks unmatched routes as 404, not a successful handler response', async () => {
    const res = await request(server).get('/api/missing').expect(404);
    const id = res.headers['x-request-id'];
    expect(id).toMatch(/^[a-f0-9-]{36}$/);
    expect(res.body as unknown).toMatchObject({ requestId: id });
    expectAccess(id, 404, '/api/missing');
  });
});
