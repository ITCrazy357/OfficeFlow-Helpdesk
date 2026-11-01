import {
  HttpException,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';

describe('Refresh cookie recovery through real HTTP controller', () => {
  let app: INestApplication;
  let server: Server;
  const auth = {
    login: jest.fn(),
    refresh: jest.fn(),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: auth }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();
    server = app.getHttpServer() as Server;
  });
  beforeEach(() => {
    jest.resetAllMocks();
    auth.login.mockResolvedValue({
      accessToken: 'fixture-access',
      refreshToken: 'fixture-original-refresh',
      refreshTokenExpiresAt: new Date(Date.now() + 60000),
      user: { id: 1 },
    });
  });
  afterAll(async () => {
    await app.close();
  });

  it.each([500, 503, 429])(
    'preserves the HttpOnly cookie after %s and recovers on retry',
    async (status) => {
      const agent = request.agent(server);
      await agent.post('/auth/login').send({}).expect(200);
      auth.refresh
        .mockRejectedValueOnce(
          new HttpException('Temporary fixture failure', status),
        )
        .mockResolvedValueOnce({
          accessToken: 'fixture-next-access',
          refreshToken: 'fixture-next-refresh',
          refreshTokenExpiresAt: new Date(Date.now() + 60000),
        });
      const failed = await agent.post('/auth/refresh').expect(status);
      expect(failed.headers['set-cookie']).toBeUndefined();
      expect(failed.headers['cache-control']).toBe('no-store');
      const recovered = await agent.post('/auth/refresh').expect(200);
      expect(recovered.body).toEqual({ accessToken: 'fixture-next-access' });
      expect(auth.refresh).toHaveBeenCalledTimes(2);
      expect(auth.refresh.mock.calls.map((call: unknown[]) => call[0])).toEqual(
        ['fixture-original-refresh', 'fixture-original-refresh'],
      );
      expect(recovered.headers['set-cookie']).toEqual(
        expect.arrayContaining([
          expect.stringContaining('fixture-next-refresh'),
        ]),
      );
    },
  );

  it('clears invalid/reused credentials and does not call the service again without a cookie', async () => {
    const agent = request.agent(server);
    await agent.post('/auth/login').send({}).expect(200);
    auth.refresh.mockRejectedValueOnce(
      new UnauthorizedException('Refresh token reuse detected'),
    );
    const rejected = await agent.post('/auth/refresh').expect(401);
    expect(rejected.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Expires=Thu, 01 Jan 1970'),
      ]),
    );
    await agent.post('/auth/refresh').expect(401);
    expect(auth.refresh).toHaveBeenCalledTimes(1);
  });
});
