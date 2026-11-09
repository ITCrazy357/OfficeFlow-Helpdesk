import {
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import type { Server } from 'node:http';
import type { Request } from 'express';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

describe('Ticket queue HTTP validation and roles', () => {
  const service = {
    getWorkload: jest.fn(),
    bulkAssign: jest.fn(),
    getTickets: jest.fn(),
  };
  const authenticate: CanActivate = {
    canActivate(context: ExecutionContext) {
      const req = context
        .switchToHttp()
        .getRequest<Request & { user: { userId: number; role: UserRole } }>();
      const role = req.headers['x-test-role'] as UserRole | undefined;
      if (!role) throw new UnauthorizedException();
      req.user = { userId: 1, role };
      return true;
    },
  };
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [{ provide: TicketsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authenticate)
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
    service.getWorkload.mockResolvedValue({ items: [], unassignedTickets: 0 });
    service.bulkAssign.mockResolvedValue({
      assignedCount: 2,
      unchangedCount: 0,
    });
    service.getTickets.mockResolvedValue({ items: [] });
  });
  afterAll(() => app.close());

  it('routes the static workload endpoint and requires authentication', async () => {
    await request(server).get('/tickets/workload').expect(401);
    await request(server)
      .get('/tickets/workload')
      .set('x-test-role', UserRole.IT_STAFF)
      .expect(200);
    expect(service.getWorkload).toHaveBeenCalledWith({
      userId: 1,
      role: UserRole.IT_STAFF,
    });
  });

  it.each([UserRole.EMPLOYEE, UserRole.MANAGER])(
    'denies workload and bulk assignment to %s',
    async (role) => {
      await request(server)
        .get('/tickets/workload')
        .set('x-test-role', role)
        .expect(403);
      await request(server)
        .patch('/tickets/bulk-assign')
        .set('x-test-role', role)
        .send({ ticketIds: [1], assignedToId: 2 })
        .expect(403);
      expect(service.bulkAssign).not.toHaveBeenCalled();
    },
  );

  it('accepts an admin batch with validated IDs', async () => {
    const body = { ticketIds: [1, 2], assignedToId: 3 };
    await request(server)
      .patch('/tickets/bulk-assign')
      .set('x-test-role', UserRole.ADMIN)
      .send(body)
      .expect(200);
    expect(service.bulkAssign).toHaveBeenCalledWith(body, {
      userId: 1,
      role: UserRole.ADMIN,
    });
  });

  it.each([
    { ticketIds: [], assignedToId: 2 },
    { ticketIds: [1, 1], assignedToId: 2 },
    { ticketIds: Array.from({ length: 11 }, (_, i) => i + 1), assignedToId: 2 },
    { ticketIds: [0], assignedToId: 2 },
    { ticketIds: ['1'], assignedToId: 2 },
    { ticketIds: [1], assignedToId: -1 },
    { ticketIds: [1], assignedToId: 2, status: 'CLOSED' },
  ])('rejects invalid bulk input: %j', async (body) => {
    await request(server)
      .patch('/tickets/bulk-assign')
      .set('x-test-role', UserRole.ADMIN)
      .send(body)
      .expect(400);
    expect(service.bulkAssign).not.toHaveBeenCalled();
  });

  it('transforms query filters and rejects malformed values', async () => {
    await request(server)
      .get('/tickets?queue=MINE&activeOnly=true')
      .set('x-test-role', UserRole.IT_STAFF)
      .expect(200);
    expect(service.getTickets).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ queue: 'MINE', activeOnly: true }),
    );
    for (const query of ['queue=OTHER', 'assignedToId=0', 'activeOnly=maybe']) {
      await request(server)
        .get(`/tickets?${query}`)
        .set('x-test-role', UserRole.ADMIN)
        .expect(400);
    }
  });
});
