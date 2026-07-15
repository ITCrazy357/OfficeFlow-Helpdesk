import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { Server } from 'node:http';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';

const mockPrismaService = {
  department: {
    findMany: jest.fn(),
  },
};

type SuccessResponseBody = {
  success: boolean;
  statusCode: number;
};

type ErrorResponseBody = SuccessResponseBody & {
  message: string;
  path: string;
};

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET ||= 'e2e-test-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();

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
      });
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
      });
  });
});
