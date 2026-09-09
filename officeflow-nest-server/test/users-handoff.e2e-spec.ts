import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import type { Server } from 'node:http';
import request from 'supertest';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { AccountService } from '../src/users/accounts.service';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';

// HTTP routing, real RolesGuard and DTO validation; authentication and DB are mocked.
describe('User handoff HTTP contract', () => {
  let app: INestApplication;
  let server: Server;
  const handoff = jest
    .fn()
    .mockResolvedValue({ reportsTransferred: 2, approvalsTransferred: 1 });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        RolesGuard,
        { provide: UsersService, useValue: { handoff } },
        { provide: AccountService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context
            .switchToHttp()
            .getRequest<Request & { user: { userId: number; role: string } }>();
          req.user = {
            userId: 1,
            role: req.header('x-test-role') || UserRole.EMPLOYEE,
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    server = app.getHttpServer() as Server;
  });

  beforeEach(() => handoff.mockClear());
  afterAll(async () => {
    await app.close();
  });

  it('allows ADMIN and forwards the parsed IDs', async () => {
    await request(server)
      .patch('/api/users/2/handoff')
      .set('x-test-role', 'ADMIN')
      .send({ replacementId: 3 })
      .expect(200);
    expect(handoff).toHaveBeenCalledWith(
      2,
      { replacementId: 3 },
      { userId: 1, role: 'ADMIN' },
    );
  });

  it.each([UserRole.EMPLOYEE, UserRole.IT_STAFF, UserRole.MANAGER])(
    'rejects %s',
    async (role) => {
      await request(server)
        .patch('/api/users/2/handoff')
        .set('x-test-role', role)
        .send({ replacementId: 3 })
        .expect(403);
      expect(handoff).not.toHaveBeenCalled();
    },
  );

  it.each([
    {},
    { replacementId: null },
    { replacementId: 0 },
    { replacementId: '3' },
    { replacementId: 1.5 },
    { replacementId: 3, isActive: false },
  ])('rejects invalid payload %j', async (body) => {
    await request(server)
      .patch('/api/users/2/handoff')
      .set('x-test-role', 'ADMIN')
      .send(body)
      .expect(400);
    expect(handoff).not.toHaveBeenCalled();
  });

  it('rejects a non-integer target ID', async () => {
    await request(server)
      .patch('/api/users/invalid/handoff')
      .set('x-test-role', 'ADMIN')
      .send({ replacementId: 3 })
      .expect(400);
    expect(handoff).not.toHaveBeenCalled();
  });
});
