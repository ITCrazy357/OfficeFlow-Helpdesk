import {
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import type { Server } from 'node:http';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { SlaController } from './sla.controller';
import { SlaPolicyService } from './sla-policy.service';
import { DEFAULT_SLA_POLICY } from './sla-policy';

describe('SLA policy HTTP validation and authorization', () => {
  const prisma = {
    slaPolicy: { findUnique: jest.fn(), upsert: jest.fn() },
    $transaction: jest.fn(),
  };
  const audit = { create: jest.fn() };
  const auth: CanActivate = {
    canActivate(context: ExecutionContext) {
      const req = context
        .switchToHttp()
        .getRequest<Request & { user: { userId: number; role: UserRole } }>();
      if (!req.headers['x-test-role']) throw new UnauthorizedException();
      req.user = { userId: 1, role: req.headers['x-test-role'] as UserRole };
      return true;
    },
  };
  let app: INestApplication;
  let server: Server;
  const body = () => ({
    version: 0,
    config: structuredClone(DEFAULT_SLA_POLICY),
  });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SlaController],
      providers: [
        SlaPolicyService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: audit },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(auth)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    server = app.getHttpServer() as Server;
  });
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.slaPolicy.findUnique.mockResolvedValue(null);
    prisma.slaPolicy.upsert.mockResolvedValue({
      version: 1,
      updatedAt: new Date(),
    });
    prisma.$transaction.mockImplementation(
      (work: (tx: typeof prisma) => Promise<unknown>) => work(prisma),
    );
  });
  afterAll(() => app.close());

  it('requires authentication and allows only ADMIN to read or edit', async () => {
    await request(server).get('/sla/policy').expect(401);
    for (const role of [
      UserRole.MANAGER,
      UserRole.IT_STAFF,
      UserRole.EMPLOYEE,
    ]) {
      await request(server)
        .get('/sla/policy')
        .set('x-test-role', role)
        .expect(403);
      await request(server)
        .put('/sla/policy')
        .set('x-test-role', role)
        .send(body())
        .expect(403);
    }
    expect(prisma.slaPolicy.upsert).not.toHaveBeenCalled();
  });

  it('returns defaults without writing them and saves with an audit in the transaction', async () => {
    const response = await request(server)
      .get('/sla/policy')
      .set('x-test-role', UserRole.ADMIN)
      .expect(200);
    expect(response.body).toMatchObject({
      version: 0,
      config: DEFAULT_SLA_POLICY,
    });
    expect(prisma.slaPolicy.upsert).not.toHaveBeenCalled();
    await request(server)
      .put('/sla/policy')
      .set('x-test-role', UserRole.ADMIN)
      .send(body())
      .expect(200);
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'SLA_POLICY', actorId: 1 }),
      prisma,
    );
  });

  it('rejects a stale editor version without writes', async () => {
    prisma.slaPolicy.findUnique.mockResolvedValue({
      version: 2,
      config: DEFAULT_SLA_POLICY,
      updatedAt: new Date(),
    });
    await request(server)
      .put('/sla/policy')
      .set('x-test-role', UserRole.ADMIN)
      .send(body())
      .expect(409);
    expect(prisma.slaPolicy.upsert).not.toHaveBeenCalled();
  });

  it.each([
    { config: { ...DEFAULT_SLA_POLICY, timezone: 'not/a-zone' } },
    {
      config: {
        ...DEFAULT_SLA_POLICY,
        mode: 'BUSINESS',
        workingDays: [],
        workingHours: [],
      },
    },
    {
      config: {
        ...DEFAULT_SLA_POLICY,
        workingHours: [
          { start: '08:00', end: '17:00' },
          { start: '13:00', end: '17:00' },
        ],
      },
    },
    { config: { ...DEFAULT_SLA_POLICY, holidays: ['2026-02-30'] } },
    { config: { ...DEFAULT_SLA_POLICY, targets: {} } },
    { config: { ...DEFAULT_SLA_POLICY, targets: [] } },
    {
      config: {
        ...DEFAULT_SLA_POLICY,
        targets: {
          ...DEFAULT_SLA_POLICY.targets,
          URGENT: { responseMinutes: 241, resolutionMinutes: 240 },
        },
      },
    },
    { config: { ...DEFAULT_SLA_POLICY, warningMinutes: -1 } },
    { config: { ...DEFAULT_SLA_POLICY, unexpected: true } },
  ])('rejects malformed or inconsistent policies', async (input) => {
    await request(server)
      .put('/sla/policy')
      .set('x-test-role', UserRole.ADMIN)
      .send({ version: 0, ...input })
      .expect(400);
    expect(prisma.slaPolicy.upsert).not.toHaveBeenCalled();
  });
});
