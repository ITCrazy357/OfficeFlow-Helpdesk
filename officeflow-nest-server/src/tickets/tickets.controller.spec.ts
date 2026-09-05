import {
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { Server } from 'node:http';
import request from 'supertest';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

type AuthenticatedRequest = {
  user?: CurrentUserPayload;
};

describe('TicketsController attachment upload', () => {
  const currentUser: CurrentUserPayload = {
    userId: 1,
    role: UserRole.ADMIN,
  };
  const mockTicketsService = {
    uploadAttachment: jest.fn(),
  };
  const allowAuthenticatedRequest: CanActivate = {
    canActivate(context: ExecutionContext) {
      const authenticatedRequest = context
        .switchToHttp()
        .getRequest<AuthenticatedRequest>();
      authenticatedRequest.user = currentUser;

      return true;
    },
  };

  let app: INestApplication;
  let httpServer: Server;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        {
          provide: TicketsService,
          useValue: mockTicketsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowAuthenticatedRequest)
      .overrideGuard(RolesGuard)
      .useValue(allowAuthenticatedRequest)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    httpServer = app.getHttpServer() as Server;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockTicketsService.uploadAttachment.mockResolvedValue({ id: 20 });
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a JPEG detected from its magic number', async () => {
    const jpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
    ]);

    await request(httpServer)
      .post('/tickets/5/attachments')
      .attach('file', jpegBuffer, {
        filename: 'photo.jpg',
        contentType: 'application/octet-stream',
      })
      .expect(201);

    expect(mockTicketsService.uploadAttachment).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        originalname: 'photo.jpg',
      }),
      currentUser,
    );
  });

  it('rejects a fake JPEG before calling the service', async () => {
    await request(httpServer)
      .post('/tickets/5/attachments')
      .attach('file', Buffer.from('plain text pretending to be an image'), {
        filename: 'malware.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);

    expect(mockTicketsService.uploadAttachment).not.toHaveBeenCalled();
  });

  it('rejects an unsupported file before calling the service', async () => {
    await request(httpServer)
      .post('/tickets/5/attachments')
      .attach('file', Buffer.from('GIF89a'), {
        filename: 'image.gif',
        contentType: 'image/gif',
      })
      .expect(400);

    expect(mockTicketsService.uploadAttachment).not.toHaveBeenCalled();
  });

  it('rejects a request without a file before calling the service', async () => {
    await request(httpServer).post('/tickets/5/attachments').expect(400);

    expect(mockTicketsService.uploadAttachment).not.toHaveBeenCalled();
  });

  it('rejects a file larger than 10 MB before calling the service', async () => {
    const oversizedBuffer = Buffer.alloc(10 * 1024 * 1024 + 1, 0);

    await request(httpServer)
      .post('/tickets/5/attachments')
      .attach('file', oversizedBuffer, {
        filename: 'oversized.pdf',
        contentType: 'application/pdf',
      })
      .expect(413);

    expect(mockTicketsService.uploadAttachment).not.toHaveBeenCalled();
  });
});
