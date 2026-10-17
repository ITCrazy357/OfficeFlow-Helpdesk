import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerStorageService } from '@nestjs/throttler';
import { Server } from 'node:http';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { requestObservabilityMiddleware } from '../src/common/middleware/request-observability.middleware';
import { PrismaService } from '../src/prisma/prisma.service';
import { ResilientThrottlerStorage } from '../src/redis/resilient-throttler.storage';
import { RedisService } from '../src/redis/redis.service';
import { MailService } from '../src/mail/mail.service';
import { OutboxProcessor } from '../src/outbox/outbox.processor';
import { OutboxMetricsCollector } from '../src/outbox/outbox-metrics.collector';
import { SlaService } from '../src/sla/sla.service';
import { AssetWarrantyReminderService } from '../src/assets/asset-warranty-reminder.service';
import { RefreshTokenCleanupService } from '../src/auth/refresh-token-cleanup.service';
import { MetricsService } from '../src/metrics/metrics.service';

const mockPrismaService = {
  $queryRaw: jest.fn().mockResolvedValue([{ connected: 1 }]),
  assertReady: jest.fn().mockResolvedValue(undefined),
  refreshToken: { findUnique: jest.fn() },
  ticket: {
    findMany: jest.fn<Promise<unknown[]>, [{ where: { AND: unknown[] } }]>(),
    count: jest.fn(),
  },
  ticketHistory: { groupBy: jest.fn() },
  $transaction: jest.fn(),
  department: {
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

type SuccessResponseBody = {
  success: boolean;
  statusCode: number;
  message?: string;
  data?: unknown;
};

type ErrorResponseBody = SuccessResponseBody & {
  message: string;
  path: string;
  requestId: string;
};

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET ||= 'e2e-test-secret-at-least-32-bytes';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(RedisService)
      .useValue({
        key: (...parts: Array<string | number>) =>
          ['officeflow:http-test', ...parts].join(':'),
        isReady: () => false,
      })
      .overrideProvider(MailService)
      .useValue({ isEnabled: () => false })
      .overrideProvider(OutboxProcessor)
      .useValue({})
      .overrideProvider(OutboxMetricsCollector)
      .useValue({})
      .overrideProvider(SlaService)
      .useValue({})
      .overrideProvider(AssetWarrantyReminderService)
      .useValue({})
      .overrideProvider(RefreshTokenCleanupService)
      .useValue({})
      .overrideProvider(ResilientThrottlerStorage)
      .useValue(new ThrottlerStorageService())
      .compile();

    app = moduleFixture.createNestApplication();
    // Resolve from the real AppModule: missing MetricsModule registration must fail.
    const metrics = app.get(MetricsService);
    app.use((req: Request, res: Response, next: NextFunction) => {
      requestObservabilityMiddleware(req, res, next, metrics);
    });

    app.setGlobalPrefix('api');

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    app.useGlobalFilters(new HttpExceptionFilter());

    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));

    await app.init();
    httpServer = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/health (GET)', () => {
    return request(httpServer)
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        const body = res.body as SuccessResponseBody;

        expect(body.success).toBe(true);
        expect(body.statusCode).toBe(200);
        expect(res.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
        expect(body.data).toEqual({
          status: 'ok',
          version: 'local',
        });
      });
  });

  it('/api/db-health (GET)', () => {
    return request(httpServer)
      .get('/api/db-health')
      .expect(200)
      .expect((res) => {
        const body = res.body as SuccessResponseBody;

        expect(body.success).toBe(true);
        expect(body.data).toEqual({
          status: 'ok',
          version: 'local',
        });
      });
  });

  it('/api/db-health rejects an incomplete schema even when the DB connects', async () => {
    mockPrismaService.assertReady.mockRejectedValueOnce(
      new Error('Missing SLA table secret-database-url'),
    );
    const response = await request(httpServer)
      .get('/api/db-health')
      .expect(500);
    expect(JSON.stringify(response.body)).not.toContain('secret-database-url');
    expect((response.body as ErrorResponseBody).success).toBe(false);
  });
  it('/api/auth/login should return validation error when email is missing', () => {
    return request(httpServer)
      .post('/api/auth/login')
      .send({
        password: '123456',
      })
      .expect(400)
      .expect((res) => {
        const body = res.body as ErrorResponseBody;

        expect(body.success).toBe(false);
        expect(body.statusCode).toBe(400);
        expect(body.message).toBe('Validation failed');
        expect(body.path).toBe('/api/auth/login');
        expect(body.requestId).toMatch(/^[a-f0-9-]{36}$/);
        expect(res.headers['x-request-id']).toBe(body.requestId);
      });
  });

  it('/api/auth/login should enforce the login pair limit', async () => {
    const payload = {
      email: `not-an-email-${Date.now()}`,
      password: 'invalid-password',
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(httpServer)
        .post('/api/auth/login')
        .send(payload)
        .expect(400);
    }

    await request(httpServer).post('/api/auth/login').send(payload).expect(429);
  });

  it('/api/auth/register should not exist', () => {
    return request(httpServer)
      .post('/api/auth/register')
      .send({
        name: 'Employee',
        email: 'employee@officeflow.com',
        password: 'strong-password-123',
      })
      .expect(404);
  });

  it('/api/auth/forgot-password should not reveal account eligibility', async () => {
    mockPrismaService.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 7,
        isActive: false,
        isLocked: false,
      });

    const unknownAccount = await request(httpServer)
      .post('/api/auth/forgot-password')
      .send({ email: ' Missing@Example.com ' })
      .expect(202);
    const ineligibleAccount = await request(httpServer)
      .post('/api/auth/forgot-password')
      .send({ email: 'inactive@example.com' })
      .expect(202);

    expect(unknownAccount.body).toEqual(ineligibleAccount.body);
    expect(mockPrismaService.user.findUnique).toHaveBeenNthCalledWith(1, {
      where: { email: 'missing@example.com' },
      select: {
        id: true,
        isActive: true,
        isLocked: true,
      },
    });
  });

  it('/api/auth/reset-password should validate the token shape', () => {
    return request(httpServer)
      .post('/api/auth/reset-password')
      .send({
        token: 'invalid-token',
        newPassword: 'new-secure-password-456',
      })
      .expect(400);
  });

  it('/api/users/:id/status should be registered and protected', () => {
    return request(httpServer)
      .patch('/api/users/16/status')
      .send({ isActive: false })
      .expect(401)
      .expect((res) => {
        const body = res.body as ErrorResponseBody;
        expect(body.requestId).toMatch(/^[a-f0-9-]{36}$/);
        expect(res.headers['x-request-id']).toBe(body.requestId);
      });
  });

  it('/api/dashboard/performance requires authentication', () => {
    return request(httpServer).get('/api/dashboard/performance').expect(401);
  });

  it('protects asset care costs and validates maintenance actions through real HTTP guards', async () => {
    const session = {
      userId: 41,
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        role: 'EMPLOYEE',
        isActive: true,
        isLocked: false,
        mustChangePassword: false,
      },
    };
    mockPrismaService.refreshToken.findUnique.mockResolvedValue(session);
    const token = app.get(JwtService).sign(
      { sub: 41, sid: 'care-session' },
      {
        issuer: 'officeflow-api',
        audience: 'officeflow-web',
        expiresIn: '5m',
      },
    );
    for (const role of ['EMPLOYEE', 'MANAGER']) {
      session.user.role = role;
      await request(httpServer)
        .get('/api/assets/care-overview')
        .auth(token, { type: 'bearer' })
        .expect(403);
      await request(httpServer)
        .get('/api/assets/1/maintenance')
        .auth(token, { type: 'bearer' })
        .expect(403);
      await request(httpServer)
        .post('/api/assets/1/maintenance')
        .auth(token, { type: 'bearer' })
        .send({})
        .expect(403);
      await request(httpServer)
        .patch('/api/assets/1/maintenance/2/complete')
        .auth(token, { type: 'bearer' })
        .send({})
        .expect(403);
    }
    session.user.role = 'ADMIN';
    await request(httpServer)
      .get('/api/assets/1/maintenance?limit=101')
      .auth(token, { type: 'bearer' })
      .expect(400);
    await request(httpServer)
      .post('/api/assets/1/maintenance')
      .auth(token, { type: 'bearer' })
      .send({ title: 'Fix', kind: 'REPAIR', scheduledFor: '2026-02-30' })
      .expect(400);
    await request(httpServer)
      .patch('/api/assets/1/maintenance/2')
      .auth(token, { type: 'bearer' })
      .send({ version: 0, kind: null })
      .expect(400);
    await request(httpServer)
      .patch('/api/assets/1/maintenance/2/complete')
      .auth(token, { type: 'bearer' })
      .send({ version: 0, performedOn: '2026-01-01', cost: '0.5' })
      .expect(400);
    await request(httpServer)
      .patch('/api/assets/1/maintenance/2/cancel')
      .auth(token, { type: 'bearer' })
      .send({ version: -1 })
      .expect(400);
  });

  it('/api/dashboard/performance validates query dates and returns the scoped report through real JWT auth', async () => {
    mockPrismaService.refreshToken.findUnique.mockResolvedValue({
      userId: 41,
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        role: 'EMPLOYEE',
        isActive: true,
        isLocked: false,
        mustChangePassword: false,
      },
    });
    mockPrismaService.ticket.findMany.mockResolvedValue([]);
    mockPrismaService.ticket.count.mockResolvedValue(0);
    mockPrismaService.$transaction.mockImplementation(
      (callback: (tx: typeof mockPrismaService) => unknown) =>
        callback(mockPrismaService),
    );
    const token = app.get(JwtService).sign(
      { sub: 41, sid: 'report-session' },
      {
        issuer: 'officeflow-api',
        audience: 'officeflow-web',
        expiresIn: '5m',
      },
    );
    const response = await request(httpServer)
      .get('/api/dashboard/performance?from=2026-01-01&to=2026-01-31')
      .auth(token, { type: 'bearer' })
      .expect(200);
    const body = response.body as {
      data: {
        cohort: { firstResponse: { minutes: number | null; samples: number } };
        daily: unknown[];
      };
    };
    expect(body.data.cohort.firstResponse).toEqual({
      minutes: null,
      samples: 0,
    });
    expect(body.data.daily).toHaveLength(31);
    expect(
      mockPrismaService.ticket.findMany.mock.calls.at(-1)?.[0].where.AND[0],
    ).toEqual({ createdById: 41 });
    for (const query of [
      'from=2026-02-30&to=2026-03-01',
      'from=2026-02-02&to=2026-02-01',
      'from=2025-01-01&to=2026-01-31',
      'from=2026-1-1&to=2026-01-31',
      'from[]=2026-01-01&to=2026-01-31',
      'from=2026-01-01&to=2026-01-31&createdById=42',
    ]) {
      await request(httpServer)
        .get(`/api/dashboard/performance?${query}`)
        .auth(token, { type: 'bearer' })
        .expect(400);
    }
  });

  it('/api/users/:id/lock-status should be registered and protected', () => {
    return request(httpServer)
      .patch('/api/users/16/lock-status')
      .send({ isLocked: true })
      .expect(401);
  });

  it('/api/users/me/password should be registered and protected', () => {
    return request(httpServer)
      .patch('/api/users/me/password')
      .send({
        currentPassword: 'temporary-password-123',
        newPassword: 'new-secure-password-456',
      })
      .expect(401);
  });
});
